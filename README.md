# PayClear — pay-transparency checker for job postings

Paste a job posting and see which US state and city pay-transparency laws apply, what's missing, and how to fix it. Free, no sign-up, and nothing leaves the browser: all checks run client-side.

## What it checks

- **Which laws apply.** It detects locations (states, `City, ST`, NYC and other covered cities), remote eligibility, and employer size, and lets you add states the role can be performed in.
- **Per-jurisdiction requirements.** Each covered jurisdiction is checked for a pay range, a benefits description, an application deadline (Colorado), and a job description (New York).
- **General red flags.** These include open-ended pay ("up to", "$90k+"), "competitive salary" with no numbers, ranges where the top is more than 2× the bottom, an unclear pay period, and remote roles with no stated region.
- **Wording.** It flags a short, high-signal list of age-coded, gendered, exclusionary, and jargon terms, with suggested replacements.

Laws not yet in force (Delaware 2027, Columbus 2027) appear as warnings. On-request states such as Nevada and Rhode Island, and employers below a size threshold, appear as notes.

## Fix with AI

The optional AI check is in `src/lib/ai.ts` and `src/app/api/analyze/route.ts`. It runs in four steps:

1. **Claude extracts** structured facts from the posting: pay, locations, remote scope, benefits, and deadline. This uses structured JSON output, so the shape is guaranteed.
2. **The rules engine judges** those facts. Claude never decides compliance.
3. **Claude rewrites** the posting to fix the engine's findings. It never invents pay, benefits, or dates. Anything it doesn't know becomes a `[placeholder]`, unless the employer supplies a pay range in the form.
4. **The rules engine re-checks the rewrite** with the regex parser, with no model involved. Placeholders are removed first so they can't count as compliant content.

The posting is treated as untrusted data in both prompts, and nothing is stored.

| Env var | Required | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes, for AI checks. Without it the site works rules-only and the "Rewrite posting" button explains that AI checks aren't turned on. | — |
| `ANTHROPIC_MODEL` | No | `claude-haiku-5-5` |
| `AI_CHECKS_PER_HOUR` | No. Per IP, per server instance. | `20` |

The built-in rate limiter is per instance and best-effort. Before you promote the site widely, put a shared limiter in front of it, such as Upstash or Vercel KV, and set a monthly spend limit in the Anthropic Console.

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

Import the repo in Vercel and use the defaults. Add `ANTHROPIC_API_KEY` under Project → Settings → Environment Variables to turn on AI checks.

## Roadmap

- Paste a URL instead of text
- Bulk checking (CSV) and a browser extension for ATS posting screens
- Alerts when a law changes
