# Contributing

Thank you for improving RepoMend.

## Before opening a change

1. Search existing issues and discussions.
2. Keep each proposal focused on a reproducible repository failure.
3. For new checks, explain the evidence, false-positive risk, remediation, and privacy impact.
4. Never commit real credentials, personal identity data, private repository information, or local absolute paths.

## Development

```bash
npm ci
npm run check
npm pack --dry-run
```

Use synthetic fixtures. Git identity fixtures must use `RepoEnjoyer` with a GitHub noreply address.

## Check design rules

- Deterministic evidence must drive the result.
- Reports must not expose the sensitive value being detected.
- `doctor` remains read-only.
- A fixer must be idempotent, previewable, and narrowly reversible.
- Network checks remain opt-in.
- A failure requires specific remediation.

## Pull requests

- Add or update tests for behaviour changes.
- Update the check catalogue for new finding identifiers.
- Document user-visible changes in the changelog.
- Confirm lint, type-checking, tests, build, and package dry-run pass.
- Keep generated output and dependency directories out of commits.
