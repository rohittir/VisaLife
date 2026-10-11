# VisaLife

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
