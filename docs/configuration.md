# Configuration

RepoMend reads `.repomend.json` from the inspected repository root. Generate the default file with `repomend init`.

```json
{
  "version": 1,
  "ignore": [],
  "failOnWarnings": false
}
```

## Fields

### `version`

Required. The only supported value is `1`. RepoMend rejects unknown formats instead of guessing.

### `ignore`

An array of exact finding identifiers. Ignored findings are omitted from every report and do not affect the exit code.

```json
{
  "version": 1,
  "ignore": ["community.code-of-conduct"],
  "failOnWarnings": false
}
```

Use this narrowly. An ignored failure receives no future remediation updates in reports.

### `failOnWarnings`

When `true`, warnings make the report unsuccessful. The `--strict` CLI flag enables the same behaviour for one run.

## Online checks

Online checks cannot be enabled in configuration. They require the explicit `--online` flag for each run so a repository cannot silently opt a contributor into network access.

## Environment variables

- `GITHUB_TOKEN`: optional read-only GitHub access for private repositories or higher rate limits. Never reported.
- `NO_COLOR`: disables terminal colour.

No environment variable can enable fixes or history rewriting.
