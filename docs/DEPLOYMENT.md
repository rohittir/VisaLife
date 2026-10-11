# VisaLife by WorkingAlien — Deployment plan: S3 + CloudFront

Status: stages 1 and 3 implemented in `infra/` and deployed by hand as `VisaLife-prod` in `us-east-1`, on `visalife.workingalien.com`. Stages 2 and 4 are still plans.

## 1. Goal

Serve the built React app (`web/dist`, about 330 KB) from a private S3 bucket through CloudFront over HTTPS.
Define it with AWS CDK in `infra/`, as the TDD (B5) already specifies, so the Cognito, API and DynamoDB pieces can be added to the same stack later.

## 2. What the checks found

| Item | Finding | Effect on the plan |
|---|---|---|
| AWS account | `135379837669`, signed in as an IAM user, default region `ap-south-1` | Deploy with an explicit region, do not rely on the default |
| CDK bootstrap | Present in `us-east-1` and `ap-south-1`, absent in `us-east-2` | No bootstrap step needed in `us-east-1` |
| Other projects | Five CloudFront distributions and several buckets already exist | Everything new is prefixed `VisaLife` and carries a comment; nothing existing is touched |
| GitHub trust | The account already has the `token.actions.githubusercontent.com` OIDC provider | CI reuses it; creating a second one would fail |
| Route 53 | No hosted zones | A custom domain needs a domain first (see section 8) |
| App | BrowserRouter (deep links like `/journey`), no inline scripts, no inline styles, no external requests | Needs the SPA fallback; a strict Content-Security-Policy works as is |
| Users | Indian nationals living in the US | Pick a US region and US/Europe edge locations |

## 3. Decisions (recommended defaults)

- **Region:** `us-east-1`. CloudFront certificates must live there, so a custom domain adds no cross-region wiring, and the audience is in the US.
- **Environments:** one environment, `prod`, at the default `*.cloudfront.net` address with `X-Robots-Tag: noindex` until a custom domain exists. `dev` is the same stack with a destroyable bucket.
- **Bucket:** private, no static-website endpoint. CloudFront reads it through Origin Access Control.
- **Price class:** `PriceClass_100` (North America and Europe). Cheapest, and covers the audience.
- **Error fallback, not a CloudFront Function:** 403 and 404 return `/index.html` with status 200. Free and simple. Cost: a missing asset also returns HTML.

## 4. Stack (Stage 1)

New workspace `infra/` (CommonJS, `aws-cdk-lib`, `constructs`, `aws-cdk` as a dev dependency).

| Construct | Settings |
|---|---|
| `s3.Bucket` | Block all public access, enforce SSL, S3-managed encryption. Dev: destroy with auto-delete. Prod: retain. |
| `cloudfront.Distribution` | `S3BucketOrigin.withOriginAccessControl`, HTTPS redirect, HTTP/2 and 3, compression on, default root `index.html`, 403 and 404 mapped to `/index.html` 200 with error TTL 0 |
| Response headers policy (shared) | HSTS one year, `nosniff`, frame deny, `strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and a CSP of `default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| Cache behaviors | Default (index.html and the rest): `Cache-Control: no-cache`. `assets/*`: `public, max-age=31536000, immutable`. Set through two response headers policies, so one upload covers both. |
| `s3deploy.BucketDeployment` | Source `../web/dist`, invalidate `/*`, `prune: false` (matches TDD B5, so a later `policy.json` is never deleted) |
| Outputs | Distribution URL and ID, bucket name |

Root changes: add `infra` to workspaces, add `npm run deploy` (build web, then `cdk deploy`).
Test: one `aws-cdk-lib/assertions` test for public-access block, OAC, the 403 and 404 mapping, and the immutable assets behavior.

## 5. Deploy flow

1. Build and validate content: `npm run build` (the content validator runs first).
2. `cd infra && npx cdk diff -c env=dev` and read it.
3. `npx cdk deploy VisaLife-dev -c env=dev`. The first run takes about 5 to 10 minutes for the distribution.
4. Open the printed URL on a phone.

## 6. Verification

- `/` returns 200 with the security headers and `Cache-Control: no-cache`.
- `/journey` returns 200 HTML, not 404 (SPA fallback).
- `/assets/index-*.js` returns `immutable` and `content-encoding: br` or `gzip`.
- `http://` redirects to `https://`.
- The raw S3 URL returns 403.
- Browser at mobile width: onboarding, Home, reload on `/journey`, no CSP errors in the console.
- A second `cdk diff` reports no changes.

## 7. CI (Stage 2)

- GitHub Actions on push to `main`: install, `npm test`, `npm run build`, `cdk deploy --require-approval never`.
- On pull requests: tests, build and `cdk diff` only.
- AWS access through OIDC, no stored keys. One role `VisaLife-github-deploy`, trusted only for `repo:rohittir/VisaLife:ref:refs/heads/main`, allowed to assume the CDK bootstrap roles and nothing else.
- Needs the `workflow` scope on the GitHub token, which is present.

## 8. Custom domain (Stage 3): done

`visalife.workingalien.com`, set in `infra/cdk.json` context (`domain`, `certificateArn`, `hostedZoneId`, `zoneName`).

- **Certificate:** an ACM certificate in `us-east-1` covering `workingalien.com` and `*.workingalien.com`.
- **DNS:** the stack creates the A and AAAA alias records in the account's Route 53 zone for `workingalien.com`.
- **TLS:** `minimumProtocolVersion` is TLS 1.2 now that a custom certificate is attached.
- **Search engines:** still `noindex`. Set `indexable` to `true` in `cdk.json` and redeploy once the content marked `verify` has been reviewed. Add HSTS preload only after that.
- **Unset the domain** (remove `domain` from the context) and the stack serves the `cloudfront.net` address again.
- **Apex redirect:** `workingalien.com` answers every request with a 302 to `visalife.workingalien.com`, keeping path and query. A second tiny CloudFront distribution runs one function (`infra/lib/redirect.js`); both http and https take one hop. `www.workingalien.com` has no record. Switch the function to 301 when the move is permanent, and turn it off with `apexRedirect: false`.

## 9. Backend hook (Stage 4, from TDD B5)

Cognito, REST API with `lambda-api`, DynamoDB with `dynamodb-onetable` and the daily ingest Lambda join the same stack.
Required changes at that point: `config.json` via `Source.jsonData`, `connect-src` and `form-action` in the CSP for the API and Cognito domains, and API CORS for the CloudFront origin.
Open point: with `prune: false` old hashed assets pile up slowly (about 330 KB per deploy). Switching to `prune: true` with `exclude: ['live/*']` and writing `policy.json` under `live/` fixes that. Decide then.

## 10. Rollback

Revert the commit and redeploy. The invalidation makes the previous build live within a minute or two. Index.html is never cached by browsers, so users pick it up on the next load.

## 11. Cost

CloudFront's always-free tier covers 1 TB and 10 million requests a month, so expected spend is close to zero.
Route 53 adds about $0.50 a month per hosted zone, plus the domain registration.

## 12. Risks

- **Shared account:** a mistaken `cdk destroy` or import could hit other projects. Mitigation: explicit stack name, `env` pinned, deploy role limited to this repo.
- **Unreviewed content:** nine journey steps and several checks carry a `verify` flag. Mitigation: dev stays noindex until they are reviewed.
- **Missing assets return HTML:** a broken asset path shows a blank page instead of a 404. Acceptable for a single-bundle app; monitor the console in the verification step.
- **Local deploys use IAM user keys:** fine for Stage 1; CI moves to OIDC.

## 13. Needs your decision

Decided: `us-east-1`, one `prod` environment, no domain yet, no CI, deploy by hand from this machine.
