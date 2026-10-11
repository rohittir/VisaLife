# VisaLife by WorkingAlien

Mobile-only web app for Indian nationals in the US on H-1B, H-4 and F-1 (OPT / STEM OPT).
It turns "my visa + my stage + what is happening" into a short **Check now** list with official links.

- Product: [docs/PRD.md](docs/PRD.md)
- Technical design: [docs/TDD.md](docs/TDD.md)

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # content validation + unit tests
npm run build
```

Everything works without an account; the profile lives in `localStorage`.
Content lives in `web/content/` (checks as JSON, journeys as JSON, steps as Markdown).
Every item needs `sources` and `lastReviewed`; `npm test` fails otherwise.

## Reading feedback

Anonymous feedback (Me, or "Send feedback" under every tab) is written one JSON object per message to a private S3 bucket. Nothing links a message to a person, and nothing in the app shows it. The bucket name is the stack output `FeedbackBucketName` (`npm run deploy` prints it; `aws cloudformation describe-stacks --stack-name VisaLife-prod --query "Stacks[0].Outputs" --region us-east-1` lists it later).

```bash
aws s3 sync s3://<FeedbackBucketName>/feedback ./feedback --region us-east-1
```

Each file is `feedback/YYYY/MM/DD/<id>.json`: `{ v, id, at, category, message, context? }`. Receipt numbers, A-numbers, emails, phone numbers and SSNs are masked as `[removed]` before saving. The function can only write to the bucket, so reading needs your own AWS credentials.
