const path = require('path');
const { Duration, RemovalPolicy, CfnOutput } = require('aws-cdk-lib');
const s3 = require('aws-cdk-lib/aws-s3');
const iam = require('aws-cdk-lib/aws-iam');
const lambda = require('aws-cdk-lib/aws-lambda');
const { NodejsFunction, OutputFormat } = require('aws-cdk-lib/aws-lambda-nodejs');
const logs = require('aws-cdk-lib/aws-logs');
const apigateway = require('aws-cdk-lib/aws-apigateway');

/**
 * Anonymous feedback: POST /api/feedback -> Lambda -> a private bucket that the Lambda can only write to.
 * CloudFront forwards the whole viewer path and RestApiOrigin adds the stage, so the resources are api/feedback.
 * Returns { api } for the CloudFront `api/*` behavior.
 */
function feedbackApi(scope) {
  // Never WebBucket: its CloudFront policy makes everything in it publicly fetchable. This one holds people's words.
  const bucket = new s3.Bucket(scope, 'FeedbackBucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
    removalPolicy: RemovalPolicy.RETAIN,
  });

  const fn = new NodejsFunction(scope, 'FeedbackFn', {
    entry: path.join(__dirname, '../../api/src/feedback.js'),
    depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_22_X,
    memorySize: 128,
    timeout: Duration.seconds(10),
    reservedConcurrentExecutions: 5,
    environment: { BUCKET: bucket.bucketName },
    logGroup: new logs.LogGroup(scope, 'FeedbackLogs', { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY }),
    bundling: { format: OutputFormat.ESM, mainFields: ['module', 'main'], externalModules: ['@aws-sdk/*'] },
  });
  // One action on one prefix: grantPut would also add legal-hold, retention, tagging and Abort* actions nobody uses.
  fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: [bucket.arnForObjects('feedback/*')] }));

  const api = new apigateway.RestApi(scope, 'FeedbackApi', {
    restApiName: 'VisaLife feedback',
    endpointTypes: [apigateway.EndpointType.REGIONAL],
    cloudWatchRole: false, // that role is account-wide; nothing here logs access
    deployOptions: { stageName: 'prod', throttlingRateLimit: 5, throttlingBurstLimit: 10 },
  });
  api.root.addResource('api').addResource('feedback').addMethod('POST', new apigateway.LambdaIntegration(fn));

  new CfnOutput(scope, 'FeedbackBucketName', { value: bucket.bucketName });
  new CfnOutput(scope, 'FeedbackApiUrl', { value: api.url });
  return { api };
}

module.exports = { feedbackApi };
