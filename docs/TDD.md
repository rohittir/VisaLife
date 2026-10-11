# VisaLife by WorkingAlien — Technical Design Document (Phase 1)

## B1. Architecture

```
Phone (PWA)                          AWS (one CDK stack per env: dev, prod)
┌──────────────────────┐             ┌──────────────────────────────────────────────┐
│ React (JS) + Vite    │  HTTPS      │ CloudFront ──► S3 web bucket                  │
│ react-router         │◄───────────►│   /index.html, assets, content (bundled)      │
│ react-oidc-context   │             │   /config.json  (written by CDK at deploy)    │
│ localStorage profile │             │   /policy.json  (written daily by Lambda)     │
│ content bundled (md) │             │   /data/visa-bulletin/*.json (bundled)        │
└──────────┬───────────┘             │                                              │
           │ Authorization: <id_token>│ API Gateway REST /v1/* ──► Lambda `api`      │
           └─────────────────────────►│   CognitoUserPoolsAuthorizer   (lambda-api)  │
                                      │                                  │           │
                                      │ Cognito User Pool (Essentials)   ▼           │
                                      │   Google IdP + email OTP     DynamoDB table  │
                                      │   managed login (hosted)     (onetable)      │
                                      │                                              │
                                      │ EventBridge (daily) ──► Lambda `policyIngest`│
                                      │   Congress.gov + Federal Register ──► S3     │
                                      └──────────────────────────────────────────────┘
```

Key choices
- **Content and the checklist engine run entirely in the browser.** The backend exists only for
  profile sync and the policy ingest. Anonymous users never call the API.
- **Policy feed is a static JSON object on S3**, regenerated daily by a Lambda. No API route,
  no DynamoDB rows. `shortcut: single policy.json; move to DynamoDB + GET /v1/policy when it
  passes ~1 MB or when per-user read state is needed.`
- **One Lambda for the REST API** using `lambda-api` routing; **one** for ingest.
- **Single DynamoDB table** via `dynamodb-onetable`; Phase 1 has one model (`Profile`).
- **Runtime config** (`/config.json`) is emitted by CDK from stack outputs so the web build
  does not need to know API/Cognito ids at build time.

## B2. Repository layout

```
VisaLife/
  package.json            npm workspaces: web, api, infra, scripts
  web/                    Vite + React 18 (JavaScript)
    index.html, vite.config.js (vite-plugin-pwa)
    src/main.jsx, src/App.jsx (router + BottomTabs + AuthProvider)
    src/pages/{Onboarding,Home,Journey,Policy,Me}.jsx
    src/components/{BottomTabs,Icon,Sheet,FieldInput,CheckSheet,JitPrompt,PDMeter,Sparkline,Step,PolicyCard}.jsx
    src/lib/profile.js    ProfileProvider/useProfile over localStorage + sync
    src/lib/checks.js     rules engine (evaluates content/checks/*.json against profile)
    src/lib/dates.js      all date math (pure functions, tested), incl. resolveDates (month-only -> full ISO)
    src/lib/visas.js      shape rules for content/visas.json (precision, assume, quick), shared with the build script
    src/lib/bulletin.js   visa bulletin helpers (current?, movement, estimate)
    src/lib/content.js    import.meta.glob loaders for md/json content
    src/lib/api.js        fetch wrapper (adds id_token)
    src/lib/ics.js        calendar export
    src/styles.css        tokens + components (no UI library)
    content/journeys/{h1b,h4,f1}.json
    content/steps/*.md    frontmatter: id,title,visas,stages,sources[],lastReviewed,verify
    content/checks/*.json one array per group (common, h1b, gc, h4, f1); schema in B6
    content/glossary.md
  api/                    Node 22 ESM
    src/handler.js        lambda-api app (GET/PUT/DELETE /v1/me)
    src/policyIngest.js   scheduled ingest → S3 policy.json
    src/lib/db.js         onetable Table + schema
    src/lib/validate.js   profile allowlist validator
    src/lib/congress.js, src/lib/fedreg.js, src/lib/tags.js
    test/*.test.js        node:test
  infra/                  AWS CDK v2 (JavaScript)
    bin/visalife.js, lib/visalife-stack.js, cdk.json, test/stack.test.js
  data/visa-bulletin/YYYY-MM.json, data/policy-watchlist.json, data/consulates.json
  scripts/fetch-visa-bulletin.mjs (+ fixture test)
  docs/PRD.md, docs/TDD.md, docs/CONTENT-GUIDE.md, README.md
  .github/workflows/ci.yml   (tests + cdk synth)
```

## B3. Front end

- **Routing:** `/` (onboarding if no profile), `/home`, `/journey`, `/policy`, `/me`, `/auth/callback`.
- **Layout:** `main` is a 430px max-width column; `BottomTabs` is a floating rounded bar (12px
  inset, safe-area aware) with Today (`/home`), Journey, Policy, Me; `@media (min-width: 600px)`
  centers the column with a neutral background. One orange `.pill` slides under the labels
  (`translateX` by `--i`, set from `tabIndex(pathname)` in `lib/tabs.js`; no animation on first
  paint); tabs get press feedback and a `viewTransition` page cross-fade, and the shell scrolls
  to the top on a tab change. The router is a data router (`createBrowserRouter`) because
  `<NavLink viewTransition>` is ignored by `<BrowserRouter>`. `prefers-reduced-motion` turns the
  motion off.
- **Design tokens:** custom properties on `:root` in `styles.css` (roles, not colors: `--page`,
  `--card`, `--ink`, `--muted`, `--action`, `--hero`, `--done-*`, `--warn-*`, `--over-*`, `--nav`),
  redefined under `prefers-color-scheme: dark`. `src/lib/contrast.test.js` reads them and asserts
  WCAG AA 4.5:1 for every text pair (3:1 for borders/rings) in both modes. Orange is only for action
  buttons and the active tab, always with the navy label.
- **Sheets:** `Sheet` is a native modal `<dialog>` (Escape, focus trap, focus return from the
  platform; backdrop click closes). Used for check detail, "Something changed?", priority-date
  detail and Me editors.
- **State:** `ProfileProvider` holds the profile in React state, persists to
  `localStorage["visalife.profile"]` on every change, and exposes `update(patch | fn)` and `reset()`.
  Profile: `{v, nationality, visa, stage, dates, flags, situations, checks, dismissed, updatedAt}`.
  `dates[k]` is `YYYY-MM-DD` or, for month-precision fields, `YYYY-MM`, or `passed` for a
  `deadline` field answered "Already passed"; `dismissed` lists the fields whose "add this date"
  prompt was skipped (and `day:<field>` for a skipped exact-day card). `load()` drops any
  date-field value that is none of these (`cleanDates` in `dates.js`).
  `optStart`/`stemOptStart` are never stored.
- **Dates:** `visas.json` declares per field `precision` (`day`|`month`), `assume` (`start`|`end`,
  month fields), `group`, `deadline`, `unlock` (the just-in-time prompt text) and per stage `quick`
  (at most two ids asked in onboarding; `[]` for stages whose dates Today asks one at a time),
  optional `question` (the legend of the date control), `timing: "ahead"` (pickers only, no
  passed/ahead choice) and `skipWhen` (a check condition: when it holds Today does not ask for the
  field; `nextPrompt` in `lib/prompts.js` evaluates it with `matches()` on the resolved dates). `resolveDates(dates, VISAS.fields, today)` runs once in Home: `passed`
  becomes yesterday (so `datePast` checks fire) and never derives `optStart`/`stemOptStart`. Its
  result goes to `checks.evaluate`, the bulletin status and the countdowns, together with
  `rawDates` (what was entered) so `{pdAmbiguous}` can tell a month-only priority date from an
  exact one. `ambiguity()` in `bulletin.js` is true when a chart's cut-off falls in the entered
  month after its first day; the tile and the `gc-pd-exact-day` check then ask for the day.
  Expiry fields (`deadline`) are month precision with `assume: "end"`; Home shows one exact-day
  card (with Skip) when such a value equals the current month. `FieldInput`'s month picker is a
  `<fieldset>` of two radio rows ("Still ahead", "Already passed") for `deadline` fields, with the
  pickers under the chosen row; it narrows years and months with the pure `timingOf`,
  `yearChoices` and `monthChoices` in `dates.js`; `monthsLabel` renders month-only countdowns.
- **Content pipeline:** `import.meta.glob('../content/steps/*.md', {query:'?raw', eager:true})`
  parsed with a 15-line frontmatter splitter + `marked` for the body; checks and journeys are
  plain JSON imports. A Vite plugin step (`scripts/validate-content.mjs`, run in `prebuild`)
  fails the build if any step/check lacks `sources` or `lastReviewed`.
- **Checklist engine (`checks.js`):** pure function `evaluate(profile, checks, today) → [{check, reason}]`
  sorted by `priority` then soonest date. Rule DSL is in B6.
- **Priority date (`bulletin.js`):** pure; `content.js` globs `data/visa-bulletin/*.json` into
  `BULLETINS` and callers pass that array in as the first argument (so node tests can feed it from `fs`).
  Each file: `{month: "YYYY-MM", finalAction: {EB1, EB2, EB3}, datesForFiling: {EB1, EB2, EB3},
  uscisChart: 'datesForFiling'|'finalAction', source}` for the INDIA column; a cut-off is an ISO date,
  `"C"` (current) or `"U"` (unavailable). `latest(b)`; `status(b, pd, category)` uses the latest bulletin
  → `{month, finalAction: 'current'|'not current', datesForFiling: ..., chartUsedByUscis, cutoffs}`
  (null without a PD or category); `history(b, category, count=12)` → `[{month, cutoff}]` of Final Action
  (feeds the Sparkline); `movement(b, category, months=12)` → day-deltas, null across C/U;
  `estimate(b, pd, category)` = days from the last dated Final Action cut-off to the PD ÷ average monthly
  movement over the last 12 months (first dated cut-off to last, divided by months to the latest
  bulletin, so "U" months count as no movement) → years; 0 when current, null when movement ≤ 0.
  Rendered as "roughly N years at the last 12 months' pace, not a prediction", capped at
  "more than 50 years". New bulletins: `node scripts/fetch-visa-bulletin.mjs <url|saved.html>`, then add
  `uscisChart` from USCIS's filing-charts page.
- **Auth:** `react-oidc-context` with `authority = https://cognito-idp.<region>.amazonaws.com/<poolId>`,
  `client_id`, `redirect_uri = <origin>/auth/callback`, `response_type = code`,
  `scope = openid email profile`. "Continue with Google" calls `signinRedirect({extraQueryParams:{identity_provider:'Google'}})`;
  "Continue with email" opens managed login, where the pool's email-OTP first factor applies.
  Values come from `/config.json`.
- **Sync (`profile.js`):** on sign-in → `GET /v1/me`; if server `clientUpdatedAt` is newer,
  replace local; else `PUT /v1/me` with local. Afterwards every local change debounces (2 s) a
  `PUT`. Offline writes are retried on next load. Last-write-wins is acceptable for a single
  person's profile.
- **PWA:** `vite-plugin-pwa` with `registerType: 'autoUpdate'`; precache app shell + bundled
  content; `NetworkFirst` for `/policy.json` and `/config.json`.
- **Accessibility:** semantic buttons, 44px targets, visible focus, `prefers-color-scheme`
  dark tokens, no color-only status.

## B4. Back end (Lambda, `lambda-api`)

`api/src/handler.js`
```js
import createAPI from 'lambda-api';            // v1.x (AWS SDK v3 era); CJS default import works under esbuild ESM
import { Profile } from './lib/db.js';
import { validateProfile } from './lib/validate.js';

const api = createAPI({ version: 'v1', base: 'v1' });

api.use((req, res, next) => {                   // REST API + Cognito authorizer puts claims here
  const claims = req.requestContext?.authorizer?.claims;
  if (!claims?.sub) return res.error(401, 'unauthenticated');
  req.user = { id: claims.sub, email: claims.email };
  next();
});

api.get('/me', async (req) => (await Profile.get({ id: req.user.id })) ?? {});

api.put('/me', async (req) => {
  const body = validateProfile(req.body);       // throws {code:400}
  return Profile.upsert({ id: req.user.id, email: req.user.email, ...body });
});

api.delete('/me', async (req, res) => {
  await Profile.remove({ id: req.user.id });
  res.status(204).send();
});

api.use((err, req, res, next) => res.status(err.code || 500).json({ error: err.message }));

export const handler = (event, context) => api.run(event, context);
```
Notes
- `lambda-api` auto-detects REST (payload v1) events; API Gateway proxy integration required.
- Body limit: reject profiles > 32 KB (validator). `checks` map is capped at 500 keys.
- CORS: handled by API Gateway `defaultCorsPreflightOptions`; the Lambda also sets
  `Access-Control-Allow-Origin` via `api.use` for non-preflight responses.

`api/src/lib/db.js` (`dynamodb-onetable`)
```js
import { Table } from 'dynamodb-onetable';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export const schema = {
  format: 'onetable:1.1.0',
  version: '0.0.1',
  indexes: { primary: { hash: 'pk', sort: 'sk' } },
  models: {
    Profile: {
      pk:              { type: String, value: 'user#${id}' },
      sk:              { type: String, value: 'profile' },
      id:              { type: String, required: true },      // Cognito sub
      email:           { type: String },
      visa:            { type: String, enum: ['H1B', 'H4', 'F1'] },
      stage:           { type: String },
      dates:           { type: Object },
      flags:           { type: Object },
      situations:      { type: Array },
      checks:          { type: Object },
      dismissed:       { type: Array },
      clientUpdatedAt: { type: String },                      // client clock, used for LWW
    },
  },
  params: { isoDates: true, timestamps: true },               // adds created/updated
};

const table = new Table({ client: new DynamoDBClient({}), name: process.env.TABLE_NAME, schema });
export const Profile = table.getModel('Profile');
```
Single-table item (Phase 1 has one entity; keys are generic so `user#<id> / reminder#<kind>`
etc. can be added without migration):

| pk | sk | attributes |
|---|---|---|
| `user#<sub>` | `profile` | email, visa, stage, dates, flags, situations, checks, clientUpdatedAt, created, updated |

Access patterns: get/put/delete own profile by `sub`. No GSI in Phase 1.

`api/src/policyIngest.js` (EventBridge daily)
1. Load `data/policy-watchlist.json` (bundled) → `{bills:[{congress,type,number,tags,meaning}], fedreg:[{document_number,tags,meaning}], keywords:[…]}`.
2. **Congress.gov** (`X-Api-Key`, `format=json`, `limit=250`): `GET /v3/bill/{congress}?fromDateTime=<lastRun-2d>&sort=updateDate+desc`
   → keep bills whose `title` matches a keyword; for those and every watchlist bill,
   `GET /v3/bill/{congress}/{type}/{number}` → `title`, `latestAction`, `policyArea`, `updateDate`.
   Status derived from `latestAction.text` (regex: "Passed House|Passed Senate|Presented to the President|Became Public Law", default Introduced).
   Stay far under 5,000 req/h: ≤ 300 calls/run.
3. **Federal Register** (`GET /api/v1/documents.json`, no key): `conditions[agencies][]=homeland-security-department|u-s-citizenship-and-immigration-services|labor-department|state-department`,
   `conditions[type][]=RULE|PRORULE|PRESDOCU|NOTICE`, `conditions[publication_date][gte]=<lastRun-2d>`,
   `conditions[term]=` each keyword, `per_page=100`. Fields used: `document_number, title, type,
   html_url, publication_date, effective_on, comments_close_on, abstract, agencies[].name,
   presidential_document_type`.
4. `tags.js`: keyword → tag rules (`H-1B|H1B|specialty occupation → H1B`; `H-4 → H4`;
   `F-1|student|OPT|practical training|SEVP → F1,OPT`; `employment-based|per-country|priority date|adjustment of status → GC`;
   `visa interview|consular|waiver → TRAVEL`). Watchlist tags override.
5. Merge with the previous `policy.json` (keep items for 18 months), sort by `updatedAt` desc,
   write to the web bucket as `policy.json` with `Cache-Control: max-age=3600`.
   Output schema: `{generatedAt, items:[{id, source:'congress'|'fedreg', kind:'bill'|'rule'|'proposed'|'notice'|'presidential', title, status, statusDate, effectiveOn?, commentsCloseOn?, url, tags[], meaning?, pinned}]}`.

## B5. Infrastructure (AWS CDK v2, JavaScript, one stack `VisaLife-<env>`)

`infra/lib/visalife-stack.js` creates, in this order:

| Construct | Key props |
|---|---|
| `dynamodb.TableV2 'Table'` | pk/sk STRING, `billing: Billing.onDemand()`, `pointInTimeRecovery: true`, `removalPolicy: RETAIN` (prod) |
| `cognito.UserPool 'Users'` | `selfSignUpEnabled`, `signInAliases:{email:true}`, `autoVerify:{email:true}`, `featurePlan: FeaturePlan.ESSENTIALS`, `signInPolicy:{allowedFirstAuthFactors:{password:true, emailOtp:true}}` (password must stay true per API), `removalPolicy: RETAIN` |
| `cognito.UserPoolIdentityProviderGoogle 'Google'` | `clientId` from context, `clientSecretValue: SecretValue.secretsManager('visalife/<env>/google')`, scopes `openid email profile`, `attributeMapping:{email: ProviderAttribute.GOOGLE_EMAIL}` |
| `pool.addClient('Web')` | `authFlows:{user:true}` (USER_AUTH for email OTP), `oAuth:{flows:{authorizationCodeGrant:true}, scopes:[OPENID,EMAIL,PROFILE], callbackUrls:[<cf origin>/auth/callback, http://localhost:5173/auth/callback], logoutUrls}`, `supportedIdentityProviders:[COGNITO, GOOGLE]`, `preventUserExistenceErrors:true`; `client.node.addDependency(google)` |
| `pool.addDomain('Domain')` + `CfnManagedLoginBranding` | `cognitoDomain:{domainPrefix:'visalife-<env>'}`, `managedLoginVersion: NEWER_MANAGED_LOGIN`; branding with `useCognitoProvidedValues:true` (required for the new managed login) |
| `s3.Bucket 'Web'` | private, `blockPublicAccess: BLOCK_ALL`, `enforceSSL` |
| `cloudfront.Distribution 'Cdn'` | `S3BucketOrigin.withOriginAccessControl(web)`, `defaultRootObject:'index.html'`, 403/404 → `/index.html` 200 (SPA), HTTPS only, `priceClass: PRICE_CLASS_100` |
| `NodejsFunction 'ApiFn'` | `entry:'../api/src/handler.js'`, `runtime: NODEJS_22_X`, `bundling:{format: OutputFormat.ESM}`, env `TABLE_NAME`, `table.grantReadWriteData` |
| `apigateway.RestApi 'Api'` | `defaultCorsPreflightOptions:{allowOrigins:[cfOrigin, 'http://localhost:5173'], allowHeaders:['Authorization','Content-Type']}`, `deployOptions:{throttlingRateLimit:20, throttlingBurstLimit:50}` |
| `apigateway.CognitoUserPoolsAuthorizer 'Auth'` | `cognitoUserPools:[pool]` |
| `api.root.addProxy()` | `defaultIntegration: new LambdaIntegration(apiFn)`, `defaultMethodOptions:{authorizer, authorizationType: COGNITO}` |
| `NodejsFunction 'IngestFn'` | `entry:'../api/src/policyIngest.js'`, timeout 5 min, env `BUCKET`, `CONGRESS_API_KEY` from `SecretValue`/SSM, `web.grantPut` |
| `events.Rule 'Daily'` | `Schedule.cron({minute:'0', hour:'11'})` → `LambdaFunction(ingestFn)` |
| `s3deploy.BucketDeployment 'WebDeploy'` | `sources:[Source.asset('../web/dist'), Source.jsonData('config.json', {apiUrl: api.url, region, userPoolId: pool.userPoolId, clientId: client.userPoolClientId, domain: domain.baseUrl()})]`, `distribution` (invalidate), **`prune:false`** so `policy.json` survives |
| `CfnOutput` | CloudFront URL, API URL, pool/client ids |

Environments via `cdk.json` context (`env=dev|prod`): domain prefix, callback URLs, removal
policies. Deploy: `npm run deploy` = `npm -w web run build && npx cdk deploy -c env=dev`.
Manual, one-time: create the Google OAuth client (web application; authorized redirect URI
`https://visalife-<env>.auth.<region>.amazoncognito.com/oauth2/idpresponse`), store its secret in
Secrets Manager `visalife/<env>/google`; get a Congress.gov API key (api.data.gov) into
`visalife/<env>/congress`. Both documented in README.

## B6. Check rule schema (`web/content/checks/*.json`, one JSON array per group: common, h1b, gc, h4, f1)

```json
{
  "id": "h1b-i94-matches-i797",
  "visas": ["H1B"],
  "priority": 1,
  "when": { "situation": "ENTERED_US" },
  "title": "Just entered the US",
  "short": "Is your new I-94 correct?",
  "ask": "Does your new I-94 show H-1B and an \"Admit Until\" date matching your I-797 (+10 days)?",
  "why": "The I-94, not the visa stamp or the I-797, controls how long you may stay. Officers sometimes cut it to your passport expiry.",
  "links": [{ "label": "Get my I-94 (CBP)", "url": "https://i94.cbp.dhs.gov" }],
  "onNo": "h1b-i94-short-fix",
  "repeat": "perTrigger",
  "sources": ["https://www.cbp.gov/travel/international-visitors/i-94"],
  "lastReviewed": "2026-10-10",
  "verify": false
}
```
`when` is one of (or `{all:[…]}` / `{any:[…]}`):
- `{situation: "ENTERED_US"|"TRAVEL_SOON"|"CHANGING_EMPLOYER"|"LAID_OFF"|"GRADUATING"|"MOVED"}`
- `{stage: ["gc_waiting_pd", "i485_pending"]}`
- `{dateWithin: {field: "i797Expiry", days: 180}}` · `{datePast: {field: "optEnd"}}`
- `{season: {from: "02-15", to: "03-31"}}`
- `{field: "flags.kidsUnder21", eq: true}` · `{computed: "kidAge", gte: 20}`
- `{pdCurrent: "datesForFiling"|"finalAction"|"uscis"}` (uses bulletin for `dates.ebCategory`; `"uscis"` = the chart USCIS accepts this month)
- `{pdAmbiguous: "datesForFiling"|"finalAction"|"uscis"}` (month-only priority date whose chart cut-off is in the same month)
`repeat`: `once` (default), `perTrigger` (reset when the situation is toggled on again) or `monthly` (a "yes" lasts until the calendar month changes, used for the Visa Bulletin check).
Also available: `{always: true}`, `{not: …}`, `{dateSet: "field"}`, `{dateUnset: "field"}`, `{followUpOf: "check-id"}` (shown when that check was answered "Not yet"; this is how `onNo` resolves).
`onNo`: id of the follow-up check revealed when the user taps "Not yet".
`short`: the headline shown on Today (hero and rows): at most 8 words and 60 characters, a question
where natural, sentence case. `title` is the situation chip and `ask` the long text in the detail
sheet. The build script requires `short`.

## B7. API contract (`/v1`, all routes require a Cognito ID token)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/me` | — | `200` profile or `{}` |
| PUT | `/me` | `{visa, stage, dates, flags, situations, checks, dismissed, clientUpdatedAt}` (allowlisted keys; `YYYY-MM-DD`, `YYYY-MM` or `passed` dates; ≤ 32 KB) | `200` stored profile |
| DELETE | `/me` | — | `204` |
| any | other | — | `404 {error}`; auth failures `401`; validation `400 {error}` |

## B8. Security and privacy

- Anonymous use sends nothing to the backend. Signed-in users store only email + the profile.
- JWT verified by API Gateway (Cognito authorizer); Lambda trusts `claims.sub` only.
- IAM: `ApiFn` read/write on the one table; `IngestFn` `s3:PutObject` on one bucket.
- Secrets (Google client secret, Congress key) in Secrets Manager, never in code or `config.json`.
- CORS restricted to the CloudFront origin (+ localhost in dev). Rate limiting on the stage.
- `DELETE /v1/me` plus device clear = full erasure. No analytics SDKs in Phase 1.
- Headers via CloudFront response headers policy: HSTS, `X-Content-Type-Options`, CSP allowing
  self + Cognito domain.

## B9. Testing and CI

- `web`: `node --test` on `dates.test.js` (6-year clock with recapture, §104(c)/§106(a)
  eligibility, OPT window, unemployment days 90/150, I-983 evaluation dates, cap-gap end,
  grace-period end), `checks.test.js` (each `when` operator, `perTrigger` reset, `onNo` chain),
  `bulletin.test.js` (current/not current on both charts, movement, estimate guard, exact-day ambiguity),
  `visas.test.js` (precision, assume and quick shape), `contrast.test.js` (WCAG AA in light and dark).
- `api`: `handler.test.js` runs `api.run()` with a crafted REST event (claims present/missing,
  bad body) against a mocked `Profile`; `tags.test.js`; `policyIngest` tested with recorded
  JSON fixtures from both APIs.
- `scripts`: bulletin parser against a saved HTML fixture.
- `infra`: one `assertions.Template` test (table keys, authorizer on proxy, bucket not public).
- CI (`.github/workflows/ci.yml`): `npm ci && npm test -ws && npx cdk synth -c env=dev`.
- Manual acceptance in the built-in browser at the mobile preset: walk the four personas from
  A4 through onboarding → Home checks → Journey → Policy → Me; toggle offline; sign in with
  Google and with email code on a real phone via the CloudFront URL; run `IngestFn` once and
  confirm `policy.json` renders.

## B10. Cost (expected, Phase 1)

CloudFront/S3 within free tier at < 1 TB; Lambda + API Gateway < $1/month at 10k MAU;
DynamoDB on-demand pennies; Cognito Essentials free to 10k MAU; Secrets Manager ~$0.80/secret/month.

## B11. Milestones (vertical slice first)

1. **Scaffold:** workspaces, Vite React JS PWA, router, tabs, tokens, `ProfileProvider`,
   onboarding → Home status line. `docs/PRD.md`, `docs/TDD.md`, README.
2. **Check now (H-1B):** `checks.js` engine + ~25 H-1B/common checks from A6.1; situation
   chips; `dates.js` with tests. This is the first demo.
3. **Priority date:** seed last 12 bulletins into `data/visa-bulletin/`, `bulletin.js`,
   PDMeter + Sparkline, "current for filing" check; `scripts/fetch-visa-bulletin.mjs`.
4. **H-4 and F-1:** their checks, stages, Journey content (~20 steps each), counters
   (unemployment days, I-983 dates), lottery-season check.
5. **Journey tab + content validation** for all three visas; `.ics` export.
6. **Infra + sync:** CDK stack (B5), `handler.js` + `db.js` + validator with tests, Me tab
   sign-in (Google + email code), sync, delete account, `config.json` bootstrap; deploy `dev`.
7. **Policy feed:** `policyIngest.js`, watchlist with "what it means" for the seed items,
   Policy tab, Home alerts; schedule.
8. **Polish:** offline caching, dark mode, disclaimer/last-reviewed badges, SES production
   access request (for Phase 1b alerts), prod deploy.

## B12. Open items / manual steps for the user

- Create the Google OAuth client and put its secret in Secrets Manager (B5).
- Request a Congress.gov API key (free, api.data.gov).
- Pick AWS account/region and a domain name (optional; CloudFront URL works without one).
- Product name is settled: VisaLife by WorkingAlien.

## References used for this design

- CDK Cognito passwordless/first-factor settings: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito-readme.html and https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.UserPoolProps.html
- `lambda-api` README: https://github.com/jeremydaly/lambda-api
- `dynamodb-onetable` quick tour: https://doc.onetable.io/start/quick-tour/
- Congress.gov API docs: https://github.com/libraryofcongress/api.congress.gov (5,000 req/h, `limit` ≤ 250, `format=json`)
- Federal Register API: https://www.federalregister.gov/developers/documentation/api/v1 (no key)
- Weighted H-1B selection final rule coverage (verify against the Federal Register): https://www.huschblackwell.com/newsandinsights/department-of-homeland-security-issues-final-rule-on-weighted-h-1b-registration-selection-process , https://www.bipc.com/fy-2027-h-1b-cap-registration-opens-march-4,-2026-key-changes-and-action-items
