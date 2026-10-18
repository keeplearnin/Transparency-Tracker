# PayClear — pay-transparency checker for job postings

Paste a job posting and see which US state and city pay-transparency laws apply, what's missing, and how to fix it. Free, no sign-up, and nothing leaves the browser: all checks run client-side.

## What it checks

- **Which laws apply.** It detects locations (states, `City, ST`, NYC and other covered cities), remote eligibility, and employer size, and lets you add states the role can be performed in.
- **Per-jurisdiction requirements.** Each covered jurisdiction is checked for a pay range, a benefits description, an application deadline (Colorado), and a job description (New York).
- **General red flags.** These include open-ended pay ("up to", "$90k+"), "competitive salary" with no numbers, ranges where the top is more than 2× the bottom, an unclear pay period, and remote roles with no stated region.
- **Wording.** It flags a short, high-signal list of age-coded, gendered, exclusionary, and jargon terms, with suggested replacements.

Laws not yet in force (Delaware 2027, Columbus 2027) appear as warnings. On-request states such as Nevada and Rhode Island, and employers below a size threshold, appear as notes.

## The rules data

`src/lib/jurisdictions.ts` is the core asset. Each rule records:

- effective date
- employee threshold
- required elements
- coverage summary
- source links
- a `verified` date

To keep the rules current:

1. Re-check the trackers listed in the sources monthly, plus any new state laws.
2. Update the rule, its `verified` date, and `LAST_REVIEWED`.
3. Add or adjust a test in `src/lib/__tests__/checker.test.ts`.

**Not legal advice.** The rules are simplified summaries. Every result links to its source.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (vitest)
npm run build
```

## Deploy

Import the repo in Vercel and use the defaults. No environment variables are needed.

## Roadmap

- v2: Claude-powered extraction for messy postings, plus a suggested compliant rewrite
- Paste a URL instead of text
- Bulk checking (CSV) and a browser extension for ATS posting screens
- Alerts when a law changes
