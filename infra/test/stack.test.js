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
