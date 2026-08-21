# AI code review (GitHub Actions)

On every non-draft PR targeting **`main`**, the `AI code review` workflow:

1. Fetches the PR diff
2. Redacts common secret shapes
3. Asks an LLM to review against [`criteria.md`](./criteria.md):
   - Security
   - Flaws / correctness
   - Single Responsibility Principle (SRP)
   - Human readability
4. Posts (or updates) one PR comment with the findings

Deterministic CI (lint, tests, gitleaks) lives in `.github/workflows/ci.yml` and also runs on pushes/PRs to `main`.

## One-time setup (required for AI)

1. Create an API key at [Anthropic](https://console.anthropic.com/) **or** [OpenAI](https://platform.openai.com/).
2. In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Preferred: `ANTHROPIC_API_KEY`
   - Or: `OPENAI_API_KEY`
3. Optional repo **Variables** (Actions → Variables):
   - `ANTHROPIC_MODEL` (default in script: `claude-sonnet-4-20250514`)
   - `OPENAI_MODEL` (default: `gpt-4.1-mini`)

If neither secret is set, the workflow still runs and posts a setup notice on the PR (it does not fail the whole pipeline).

## Branch protection (recommended)

In **Settings → Branches → Branch protection rules** for `main`:

- Require a pull request before merging
- Require status checks: `Frontend (lint · test · build)`, `Backend (pytest)`, `Secret scan (gitleaks)`
- Keep the AI review **informational** at first (do not require it) until you trust the signal

## Cost / privacy notes

- Diff text is sent to the LLM provider you configure — do not put production secrets in PRs.
- Draft PRs are skipped to reduce spend.
- Large PRs may be truncated; split big merges when you can.
