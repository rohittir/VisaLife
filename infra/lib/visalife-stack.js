const path = require('path');
const { Stack, Duration, RemovalPolicy, CfnOutput } = require('aws-cdk-lib');
const s3 = require('aws-cdk-lib/aws-s3');
const s3deploy = require('aws-cdk-lib/aws-s3-deployment');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const acm = require('aws-cdk-lib/aws-certificatemanager');
const route53 = require('aws-cdk-lib/aws-route53');
const targets = require('aws-cdk-lib/aws-route53-targets');
const { redirectCode } = require('./redirect');
const { feedbackApi } = require('./feedback');

// Everything the browser needs comes from 'self', the feedback call included: /api/* is a CloudFront behavior on the same
// origin, so no connect-src is needed. Add the Cognito host here when sign-in lands.
const CSP = "default-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

class VisaLifeStack extends Stack {
  /**
   * props: { envName: 'dev'|'prod', webDist?: string,
   *   domain?: string, certificateArn?: string (ACM, us-east-1, covering domain),
   *   hostedZoneId?: string, zoneName?: string (creates the A and AAAA alias records),
   *   indexable?: boolean (search engines may index; default false),
   *   apexRedirect?: boolean (zoneName itself redirects to domain; needs all of the above) }
   */
  constructor(scope, id, props) {
    super(scope, id, props);
    const { envName, domain, certificateArn, hostedZoneId, zoneName, indexable = false, apexRedirect = false, webDist = path.join(__dirname, '../../web/dist') } = props;
    if (domain && !certificateArn) throw new Error('domain needs certificateArn: an ACM certificate in us-east-1 that covers it');
    if (apexRedirect && !(domain && hostedZoneId && zoneName)) throw new Error('apexRedirect needs domain, certificateArn, hostedZoneId and zoneName');
    const certificate = domain ? acm.Certificate.fromCertificateArn(this, 'Cert', certificateArn) : undefined;
    const zone = domain && hostedZoneId ? route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', { hostedZoneId, zoneName }) : undefined;
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
            // Stay out of search results until `indexable` is set (the unreviewed "verify" content is checked).
            ...(indexable ? [] : [{ header: 'X-Robots-Tag', value: 'noindex', override: true }]),
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

    const feedback = feedbackApi(this);

    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: `VisaLife ${envName}`,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // The default cloudfront.net certificate fixes the TLS policy, so TLS 1.2 is enforceable only with a custom certificate.
      ...(domain
        ? {
            domainNames: [domain],
            certificate,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
          }
        : {}),
      defaultBehavior: behavior(headersPolicy('PageHeaders', 'no-cache')),
      additionalBehaviors: {
        'assets/*': behavior(headersPolicy('AssetHeaders', 'public, max-age=31536000, immutable')),
        // Written out, not behavior(): that helper allows GET and HEAD only, and the API takes POST. The viewer's Host
        // header is not forwarded, because API Gateway routes on its own domain. Never cached.
        'api/*': {
          origin: new origins.RestApiOrigin(feedback.api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: headersPolicy('ApiHeaders', 'no-store'),
        },
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

    if (zone) {
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
      new route53.ARecord(this, 'AliasA', { zone, recordName: domain, target });
      new route53.AaaaRecord(this, 'AliasAaaa', { zone, recordName: domain, target });
    }

    if (apexRedirect) {
      // A second distribution whose function answers every request, so the origin below is never contacted.
      const apex = new cloudfront.Distribution(this, 'ApexCdn', {
        comment: `VisaLife ${envName} redirect from ${zoneName}`,
        domainNames: [zoneName],
        certificate,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        defaultBehavior: {
          origin: new origins.HttpOrigin(domain),
          // Both http and https get one hop straight to the https target.
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          functionAssociations: [
            {
              function: new cloudfront.Function(this, 'ApexRedirectFn', {
                code: cloudfront.FunctionCode.fromInline(redirectCode(domain)),
                runtime: cloudfront.FunctionRuntime.JS_2_0,
              }),
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      });
      const apexTarget = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(apex));
      new route53.ARecord(this, 'ApexA', { zone, recordName: zoneName, target: apexTarget });
      new route53.AaaaRecord(this, 'ApexAaaa', { zone, recordName: zoneName, target: apexTarget });
      new CfnOutput(this, 'ApexRedirect', { value: `https://${zoneName} redirects to https://${domain}` });
    }

    new CfnOutput(this, 'SiteUrl', { value: `https://${domain ?? distribution.distributionDomainName}` });
    new CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}

module.exports = { VisaLifeStack };
