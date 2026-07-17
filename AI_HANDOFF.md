# AI handoff

## Project intent

RepoMend is a deterministic, privacy-safe repository doctor. It should solve concrete Git and publishing failures without requiring an AI model. Preserve that boundary: AI may help develop RepoMend, but it is not a runtime dependency or authority.

## Architecture

- `src/cli.ts`: dependency-free argument parsing, exit codes, output handling, and signal cancellation.
- `src/doctor.ts`: loads configuration, runs checks in a stable order, filters ignored identifiers, and determines health.
- `src/checks/`: independent deterministic check groups.
- `src/redact.ts`: last-line redaction for identities, credentials, tokens, and personal paths.
- `src/shell.ts`: shell-free child-process runner with timeouts. Raw output is allowed only for internal identity and remote classification and must never be copied into findings.
- `src/fix.ts`: explicit, idempotent, dry-run-first mutations.
- `src/reporters/`: pretty, Markdown, and JSON renderers.

## Important decisions

1. **No runtime dependencies.** The installed CLI uses Node.js built-ins only.
2. **Read-only doctor.** Inspection cannot fetch, install, modify, commit, push, or change GitHub settings.
3. **Opt-in network.** Only `--online` contacts `api.github.com`; local files are never uploaded.
4. **No sensitive evidence in reports.** Findings describe categories and counts, not raw email, remote, path, token, or symlink values.
5. **No numeric score.** A privacy failure cannot be averaged away by unrelated passes.
6. **Conservative fixes.** `.gitignore` additions and repository-local identity are the only v1 mutations.

## Current limitations

- npm receives the deepest package graph check.
- Workflow checks use conservative textual analysis rather than a full YAML semantic model.
- Branch protection and rulesets require future fine-grained authentication support.
- Redaction covers common patterns, not every possible secret format.
- README checks do not execute documentation commands.

## Tests

Tests cover argument parsing, redaction, GitHub remote parsing, dry-run and applied fixes, identity privacy, ignored findings, broken README links, unsafe workflows, and all report formats. `npm run check` runs lint, strict type-checking, tests, and the production build.

## Safe next steps

1. Introduce a package-manager adapter interface and add pnpm fixtures.
2. Add SARIF output without changing the JSON v1 schema.
3. Add a full YAML parser only after evaluating its dependency and supply-chain cost.
4. Build end-to-end tests around a local bare remote for upstream and divergence cases.
5. Add read-only ruleset checks behind `--online` with explicit token-scope documentation.

## Privacy review checklist

- Search committed text for emails, tokens, absolute home paths, and private URLs.
- Confirm examples use only `RepoEnjoyer` and public repository URLs.
- Ensure new error paths call `redact` before display.
- Never place command stderr or Git config values directly in findings.
- Use synthetic fixtures and inspect JSON reports for accidental disclosure.
