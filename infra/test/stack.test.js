const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { App } = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { VisaLifeStack } = require('../lib/visalife-stack');

// The stack uploads web/dist; a one-file stand-in keeps the test independent of a web build.
const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'visalife-dist-'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html>');
const synth = (props = {}) =>
  Template.fromStack(
    new VisaLifeStack(new App(), 'T', { envName: 'prod', webDist: dist, env: { account: '111111111111', region: 'us-east-1' }, ...props }),
  );
const json = (o) => JSON.stringify(o);

test('bucket is private and read through origin access control', () => {
  const t = synth();
  t.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
  });
  t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
});

test('SPA deep links fall back to index.html with 200', () => {
  const dist = synth().findResources('AWS::CloudFront::Distribution');
  const cfg = Object.values(dist)[0].Properties.DistributionConfig;
  assert.deepEqual(
    cfg.CustomErrorResponses.map((e) => [e.ErrorCode, e.ResponseCode, e.ResponsePagePath]),
    [[403, 200, '/index.html'], [404, 200, '/index.html']],
  );
  assert.equal(cfg.DefaultRootObject, 'index.html');
});

test('hashed assets are immutable, pages are not cached, HTTP redirects', () => {
  const t = synth();
  const cfg = Object.values(t.findResources('AWS::CloudFront::Distribution'))[0].Properties.DistributionConfig;
  assert.equal(cfg.DefaultCacheBehavior.ViewerProtocolPolicy, 'redirect-to-https');
  assert.equal(cfg.CacheBehaviors[0].PathPattern, 'assets/*');
  const policies = json(t.findResources('AWS::CloudFront::ResponseHeadersPolicy'));
  assert.match(policies, /max-age=31536000, immutable/);
  assert.match(policies, /"Value":"no-cache"/);
});

const policies = (t) => JSON.stringify(t.findResources('AWS::CloudFront::ResponseHeadersPolicy'));
const custom = { domain: 'visalife.example.com', certificateArn: 'arn:aws:acm:us-east-1:111111111111:certificate/abc', hostedZoneId: 'Z123', zoneName: 'example.com' };

test('noindex stays on, even with a custom domain, until indexable is set', () => {
  assert.match(policies(synth()), /X-Robots-Tag/);
  assert.match(policies(synth(custom)), /X-Robots-Tag/);
  assert.doesNotMatch(policies(synth({ ...custom, indexable: true })), /X-Robots-Tag/);
});

test('custom domain: alias, certificate, TLS 1.2 and DNS records', () => {
  const t = synth(custom);
  const cfg = Object.values(t.findResources('AWS::CloudFront::Distribution'))[0].Properties.DistributionConfig;
  assert.deepEqual(cfg.Aliases, ['visalife.example.com']);
  assert.equal(cfg.ViewerCertificate.AcmCertificateArn, custom.certificateArn);
  assert.equal(cfg.ViewerCertificate.MinimumProtocolVersion, 'TLSv1.2_2021');
  assert.equal(cfg.ViewerCertificate.SslSupportMethod, 'sni-only');
  t.hasResourceProperties('AWS::Route53::RecordSet', { Name: 'visalife.example.com.', Type: 'A', HostedZoneId: 'Z123' });
  t.hasResourceProperties('AWS::Route53::RecordSet', { Name: 'visalife.example.com.', Type: 'AAAA' });
});

test('without a domain there is no alias and no DNS record', () => {
  const t = synth();
  const cfg = Object.values(t.findResources('AWS::CloudFront::Distribution'))[0].Properties.DistributionConfig;
  assert.equal(cfg.Aliases, undefined);
  t.resourceCountIs('AWS::Route53::RecordSet', 0);
});

test('a domain without a certificate is refused', () => {
  assert.throws(() => synth({ domain: 'visalife.example.com' }), /certificateArn/);
});

const apex = { ...custom, apexRedirect: true };
const distributions = (t) => Object.values(t.findResources('AWS::CloudFront::Distribution')).map((r) => r.Properties.DistributionConfig);

test('apex redirect: a second distribution answers the bare domain with the function and DNS points at it', () => {
  const t = synth(apex);
  const [site, redirect] = distributions(t).sort((a, b) => (a.Aliases[0] < b.Aliases[0] ? 1 : -1));
  assert.deepEqual(site.Aliases, ['visalife.example.com']);
  assert.deepEqual(redirect.Aliases, ['example.com']);
  assert.equal(redirect.ViewerCertificate.AcmCertificateArn, custom.certificateArn);
  assert.equal(redirect.DefaultCacheBehavior.FunctionAssociations[0].EventType, 'viewer-request');
  assert.equal(redirect.DefaultCacheBehavior.ViewerProtocolPolicy, 'allow-all');
  t.resourceCountIs('AWS::CloudFront::Function', 1);
  t.hasResourceProperties('AWS::Route53::RecordSet', { Name: 'example.com.', Type: 'A' });
  t.hasResourceProperties('AWS::Route53::RecordSet', { Name: 'example.com.', Type: 'AAAA' });
  assert.match(JSON.stringify(t.findResources('AWS::CloudFront::Function')), /https:\/\/visalife\.example\.com/);
});

test('no apex redirect unless asked, and not without a zone', () => {
  assert.equal(distributions(synth(custom)).length, 1);
  assert.throws(() => synth({ domain: 'a.example.com', certificateArn: 'arn:x', apexRedirect: true }), /apexRedirect needs/);
});

// Anonymous feedback: POST /api/feedback -> Lambda -> a private, write-only bucket.
const resources = (t, type) => Object.entries(t.findResources(type));
const feedbackBucket = (t) => resources(t, 'AWS::S3::Bucket').find(([id]) => id.startsWith('FeedbackBucket'));
const cfg = (t) => distributions(t)[0];

test('feedback bucket: separate, fully private, encrypted, retained; the web bucket policy is untouched', () => {
  const t = synth();
  assert.equal(resources(t, 'AWS::S3::Bucket').length, 2);
  const [id, bucket] = feedbackBucket(t);
  assert.deepEqual(bucket.Properties.PublicAccessBlockConfiguration, {
    BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
  });
  assert.equal(bucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault.SSEAlgorithm, 'AES256');
  assert.equal(bucket.DeletionPolicy, 'Retain');
  // No autoDelete custom resource for it, and no CloudFront (read) access.
  const policies = resources(t, 'AWS::S3::BucketPolicy');
  const forBucket = (prefix) => policies.find(([, p]) => p.Properties.Bucket.Ref.startsWith(prefix))[1];
  assert.doesNotMatch(json(forBucket(id)), /cloudfront|s3:GetObject|s3:List/);
  assert.match(json(forBucket('WebBucket')), /cloudfront\.amazonaws\.com/);
  assert.match(json(forBucket('WebBucket')), /s3:GetObject/);
  t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
});

test('api/* comes after assets/*, takes any method, is never cached and does not forward the Host header', () => {
  const t = synth();
  const [assets, api] = cfg(t).CacheBehaviors;
  assert.equal(assets.PathPattern, 'assets/*');
  assert.equal(api.PathPattern, 'api/*');
  assert.deepEqual([...api.AllowedMethods].sort(), ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT']);
  assert.equal(api.ViewerProtocolPolicy, 'redirect-to-https');
  assert.equal(api.CachePolicyId, '4135ea2d-6df8-44a3-9df3-4b5a84be39ad'); // Managed-CachingDisabled
  assert.equal(api.OriginRequestPolicyId, 'b689b0a8-53d0-40ab-baf2-68738e2966ac'); // Managed-AllViewerExceptHostHeader
  // The pages and assets behaviors still serve GET and HEAD only.
  assert.deepEqual(cfg(t).DefaultCacheBehavior.AllowedMethods ?? ['GET', 'HEAD'], ['GET', 'HEAD']);
  assert.deepEqual(assets.AllowedMethods, ['GET', 'HEAD']);
  // The API's own response headers: security headers and no-store.
  const hp = t.findResources('AWS::CloudFront::ResponseHeadersPolicy');
  const apiPolicy = hp[api.ResponseHeadersPolicyId.Ref];
  assert.match(json(apiPolicy), /"Value":"no-store"/);
  assert.match(json(apiPolicy), /Strict-Transport-Security|StrictTransportSecurity/);
  // Its origin is the REST API's execute-api host with the stage as origin path.
  const origin = cfg(t).Origins.find((o) => o.Id === api.TargetOriginId);
  assert.match(json(origin.DomainName), /execute-api/);
  assert.match(json(origin.OriginPath), /FeedbackApiDeploymentStageprod/);
});

test('the content security policy stays default-src self: a same-origin POST needs no connect-src', () => {
  const csp = /default-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'/;
  assert.match(policies(synth()), csp);
  assert.doesNotMatch(policies(synth()), /connect-src/);
});

test('the function can only put objects under feedback/ in its own bucket', () => {
  const t = synth();
  const [bucketId] = feedbackBucket(t);
  const fn = resources(t, 'AWS::Lambda::Function').find(([id]) => id.startsWith('FeedbackFn'))[1];
  assert.equal(fn.Properties.Runtime, 'nodejs22.x');
  assert.equal(fn.Properties.MemorySize, 128);
  assert.equal(fn.Properties.Timeout, 10);
  assert.equal(fn.Properties.ReservedConcurrentExecutions, 5);
  assert.deepEqual(fn.Properties.Environment.Variables.BUCKET, { Ref: bucketId });
  const roleId = fn.Properties.Role['Fn::GetAtt'][0];
  const [, policy] = resources(t, 'AWS::IAM::Policy').find(([, p]) => p.Properties.Roles.some((r) => r.Ref === roleId));
  const statements = policy.Properties.PolicyDocument.Statement;
  assert.equal(statements.length, 1);
  assert.deepEqual(statements[0].Action, 's3:PutObject');
  assert.equal(statements[0].Effect, 'Allow');
  assert.deepEqual(statements[0].Resource, { 'Fn::Join': ['', [{ 'Fn::GetAtt': [bucketId, 'Arn'] }, '/feedback/*']] });
  assert.doesNotMatch(json(policy), /GetObject|ListBucket|DeleteObject|s3:\*/);
});

test('the REST API is regional, throttled, and has POST api/feedback and nothing else', () => {
  const t = synth();
  const [[apiId, api]] = resources(t, 'AWS::ApiGateway::RestApi');
  assert.deepEqual(api.Properties.EndpointConfiguration.Types, ['REGIONAL']);
  t.hasResourceProperties('AWS::ApiGateway::Stage', {
    StageName: 'prod',
    MethodSettings: [{ HttpMethod: '*', ResourcePath: '/*', ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 }],
  });
  const res = resources(t, 'AWS::ApiGateway::Resource');
  const byPart = Object.fromEntries(res.map(([id, r]) => [r.Properties.PathPart, { id, parent: r.Properties.ParentId }]));
  assert.deepEqual(Object.keys(byPart).sort(), ['api', 'feedback']);
  assert.deepEqual(byPart.api.parent['Fn::GetAtt'], [apiId, 'RootResourceId']);
  assert.deepEqual(byPart.feedback.parent, { Ref: byPart.api.id });
  const methods = resources(t, 'AWS::ApiGateway::Method').map(([, m]) => m.Properties);
  assert.equal(methods.length, 1);
  assert.equal(methods[0].HttpMethod, 'POST');
  assert.equal(methods[0].AuthorizationType, 'NONE');
  assert.equal(methods[0].Integration.Type, 'AWS_PROXY');
  assert.deepEqual(methods[0].ResourceId, { Ref: byPart.feedback.id });
});

test('outputs name the feedback bucket and the API', () => {
  const out = synth().toJSON().Outputs;
  assert.ok(out.FeedbackBucketName);
  assert.ok(out.FeedbackApiUrl);
});
