const cdk = require('aws-cdk-lib');
const { VisaLifeStack } = require('../lib/visalife-stack');

const app = new cdk.App();
const envName = app.node.tryGetContext('env') ?? 'prod';
if (!['dev', 'prod'].includes(envName)) throw new Error(`env must be dev or prod, got "${envName}"`);

const ctx = (k) => app.node.tryGetContext(k) || undefined;

new VisaLifeStack(app, `VisaLife-${envName}`, {
  envName,
  domain: ctx('domain'),
  certificateArn: ctx('certificateArn'),
  hostedZoneId: ctx('hostedZoneId'),
  zoneName: ctx('zoneName'),
  indexable: ctx('indexable') === 'true' || ctx('indexable') === true,
  // us-east-1: CloudFront certificates must live here, and the users are in the US.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
});
