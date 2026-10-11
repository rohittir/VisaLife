const path = require('path');
const { Stack, Duration, RemovalPolicy, CfnOutput } = require('aws-cdk-lib');
const s3 = require('aws-cdk-lib/aws-s3');
const s3deploy = require('aws-cdk-lib/aws-s3-deployment');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');

// Everything the browser needs comes from 'self'. Add the API and Cognito hosts here when the backend lands.
const CSP = "default-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

class VisaLifeStack extends Stack {
  /** props: { envName: 'dev'|'prod', webDist?: string, domain?: string } */
  constructor(scope, id, props) {
    super(scope, id, props);
    const { envName, domain, webDist = path.join(__dirname, '../../web/dist') } = props;
    const isProd = envName === 'prod';

    const bucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    const security = {
      strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
      contentTypeOptions: { override: true },
      frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
      referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
      contentSecurityPolicy: { contentSecurityPolicy: CSP, override: true },
    };
    const headersPolicy = (name, cacheControl) =>
      new cloudfront.ResponseHeadersPolicy(this, name, {
        securityHeadersBehavior: security,
        customHeadersBehavior: {
          customHeaders: [
            { header: 'Cache-Control', value: cacheControl, override: true },
            { header: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()', override: true },
            // shortcut: stay out of search results until a custom domain exists, then drop this header.
            ...(domain ? [] : [{ header: 'X-Robots-Tag', value: 'noindex', override: true }]),
          ],
        },
      });

    const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
    const behavior = (policy) => ({
      origin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      responseHeadersPolicy: policy,
      compress: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: `VisaLife ${envName}`,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      // shortcut: the default cloudfront.net certificate fixes the TLS policy; set minimumProtocolVersion TLS_V1_2_2021 with the custom certificate.
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: behavior(headersPolicy('PageHeaders', 'no-cache')),
      additionalBehaviors: {
        'assets/*': behavior(headersPolicy('AssetHeaders', 'public, max-age=31536000, immutable')),
      },
      // BrowserRouter deep links such as /journey are not objects in the bucket.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(0),
      })),
    });

    new s3deploy.BucketDeployment(this, 'WebDeploy', {
      sources: [s3deploy.Source.asset(webDist)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
      prune: false, // keeps a later policy.json; see docs/DEPLOYMENT.md section 9
    });

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}

module.exports = { VisaLifeStack };
