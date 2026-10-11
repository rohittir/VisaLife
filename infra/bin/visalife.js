const cdk = require('aws-cdk-lib');
const { VisaLifeStack } = require('../lib/visalife-stack');

const app = new cdk.App();
const envName = app.node.tryGetContext('env') ?? 'prod';
if (!['dev', 'prod'].includes(envName)) throw new Error(`env must be dev or prod, got "${envName}"`);

new VisaLifeStack(app, `VisaLife-${envName}`, {
  envName,
  // us-east-1: CloudFront certificates must live here, and the users are in the US.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
});
