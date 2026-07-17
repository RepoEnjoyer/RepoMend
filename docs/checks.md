# Check catalogue

Finding identifiers are stable within the 1.x release line. Exact identifiers may be listed in `.repomend.json` when a documented exception is necessary.

| Group | Examples | Purpose |
| --- | --- | --- |
| `git.*` | `git.branch`, `git.remote`, `git.upstream` | Detect unsafe or unpushable Git state. |
| `privacy.*` | `privacy.git-identity`, `privacy.git-history` | Prevent author metadata disclosure without displaying the values. |
| `files.*` | `files.forbidden`, `files.large`, `files.symlinks` | Keep generated, private, oversized, or non-portable paths out of Git. |
| `project.*` | `project.lockfile`, `project.peer-dependencies` | Check reproducibility and dependency consistency. |
| `workflow.*` | `workflow.permissions`, `workflow.remote-shell` | Find common GitHub Actions safety and reproducibility problems. |
| `docs.*` | `docs.relative-links`, `docs.private-paths` | Validate local README structure and privacy. |
| `community.*` | `community.security`, `community.issue-template` | Check public-maintainer basics. |
| `github.*` | `github.pages`, `github.actions` | Compare opt-in public GitHub state with the local repository. |

## Levels

- `PASS`: evidence supports the expected safe state.
- `INFO`: useful state that does not require action.
- `WARN`: a maintainability, portability, or defence-in-depth problem.
- `FAIL`: a likely privacy, publishing, reproducibility, or security blocker.

RepoMend does not calculate a health score because a single exposed credential or broken lockfile should not be averaged away by unrelated passing checks.
