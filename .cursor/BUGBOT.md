# Mirror Image — Bugbot review rules

Review PR diffs for this React/Vite + FastAPI/Postgres app. Prefer concrete,
line-anchored findings over vague advice. Skip nitpicks that do not hurt
security, correctness, or maintainability.

## Security

Flag:

- Hardcoded secrets, tokens, private keys, webhook secrets, or credentials
- SQL built with string concatenation / f-strings instead of parameters
- Missing or weak authz on mutating routes (IDOR, role bypass)
- Unsafe file paths / uploads (path traversal, unrestricted types)
- CORS / origin allowlists that open production to `*` or leftover localhost
- JWT mishandling (weak secrets in prod paths, tokens in logs)
- XSS sinks (`dangerouslySetInnerHTML`, unsanitized HTML) and open redirects
- Stripe / payment webhook verification gaps

## Flaws (correctness & reliability)

Flag:

- Logic bugs, inverted conditions, wrong status codes, off-by-one errors
- Unhandled errors that drop user data or leave partial writes
- Race conditions on shared state (playtester, deck autosave)
- Broken invariants (auth required but optional; inconsistent role checks)
- Missing tests for high-risk new branches visible in the diff

## Single Responsibility Principle (SRP)

Flag when a unit clearly does too many jobs:

- A React component that fetches, transforms, validates, and renders complex UI with no extraction
- A FastAPI router that mixes auth, DB, billing, and email with no helpers
- A module that gains unrelated concerns in this diff

Suggest a *specific* split (name the new module/function). Do not demand
micro-splitting of tiny cohesive helpers.

## Human readability

Flag:

- Names that hide intent (`data2`, `tmp`, `handleStuff`)
- Deep nesting that could early-return
- Comments that restate code instead of explaining *why*
- Magic numbers/strings without named constants where meaning is unclear
- Inconsistent patterns next to existing code in the same file
- linear when possible logic flow top down break points where if a condition isnèt met the rest of the funtion doe not need to be read. 

## Reporting style

For each finding: severity, category (`security` | `flaw` | `srp` | `readability`),
where (path), what is wrong, why it matters, and a concrete fix direction.
Also call out 2–5 things done well so the review stays balanced.
