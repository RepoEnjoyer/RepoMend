# Troubleshooting

## RepoMend cannot find Git

Install Git and confirm `git --version` works in the same terminal. File and documentation checks can be extended to non-Git folders later, but the v1 doctor expects repository metadata.

## The branch is behind after I pulled

RepoMend uses the last fetched upstream state and never contacts a remote during local checks. Run `git fetch --prune`, review the incoming commits, then rerun the doctor.

## npm reports dependency problems

RepoMend runs `npm ls --package-lock-only --ignore-scripts --all --json`. It does not install dependencies. Reproduce with `npm ci` in a disposable worktree or fresh clone before changing the lockfile.

## Online checks return 403

GitHub applies lower limits to unauthenticated API requests. Retry after the rate-limit window or provide a fine-grained, read-only `GITHUB_TOKEN`. Do not store the token in `.repomend.json`.

## The Git identity fix did not change old commits

The fix is repository-local and affects future commits. Existing commits are immutable objects. Rewriting published history can disrupt collaborators and is intentionally outside RepoMend's automatic fixes.

## A workflow pin warning is too strict

Tags and branches can move. Pin external actions to a full commit SHA and retain the human-readable release tag as a comment. Ignore the finding only when another trusted update mechanism controls the reference.

## RepoMend found a path but did not display it

This is intentional for environment files, home paths, external symlinks, large files, and identity metadata. Use local Git commands to investigate in a trusted terminal.
