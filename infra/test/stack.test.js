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

test('noindex until a domain is configured', () => {
  assert.match(json(synth().findResources('AWS::CloudFront::ResponseHeadersPolicy')), /X-Robots-Tag/);
  assert.doesNotMatch(json(synth({ domain: 'example.com' }).findResources('AWS::CloudFront::ResponseHeadersPolicy')), /X-Robots-Tag/);
});
