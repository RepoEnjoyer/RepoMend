# Security policy

## Supported versions

Security fixes are provided for the latest released minor version.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature for this repository. Do not open a public issue containing exploit details, credentials, tokens, private repository names, personal paths, or identity metadata.

Include:

- the affected RepoMend version;
- the operating system family and Node.js major version;
- minimal reproduction steps using synthetic data;
- the expected and observed security boundary;
- whether the problem could disclose values RepoMend promises to redact.

You should receive an acknowledgement within seven days. A fix, mitigation, or status update will be provided as investigation allows.

## Security model

- Local doctor checks are read-only.
- Network access requires `--online`.
- Fixes require `--apply` and never rewrite history or push.
- Child processes are invoked without a shell.
- npm consistency checks disable lifecycle scripts.
- Reports contain repository-relative paths only and redact common identity and credential formats.

RepoMend is defence in depth, not a replacement for dedicated secret scanning, dependency auditing, or manual review.
