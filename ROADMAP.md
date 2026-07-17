# Roadmap

RepoMend follows small, testable releases. Roadmap items are not promises until assigned to a milestone.

## 1.1 — More ecosystems

- Add native pnpm, Yarn, and Bun dependency graph adapters.
- Detect Python lock and virtual-environment drift.
- Add Go module and Rust Cargo reproducibility checks.
- Test every adapter against deliberately broken fixtures.

## 1.2 — Stronger documentation proof

- Execute explicitly opted-in README commands in disposable containers.
- Check external links with caching, bounded concurrency, and domain redaction.
- Detect CLI help drift against documented flags.

## 1.3 — GitHub maintainer checks

- Inspect rulesets and branch protection with fine-grained read-only authentication.
- Emit SARIF for code-scanning ingestion.
- Publish a first-party composite GitHub Action.

## 2.0 — Standalone distribution

- Produce signed, reproducible executables for Windows, macOS, and Linux.
- Add a documented plugin API with isolated process boundaries.
- Preserve JSON report compatibility or provide an explicit migration utility.

## Explicit non-goals

- Rewriting shared Git history automatically.
- Uploading repositories to an analysis service.
- Becoming a Git GUI or package manager.
- Using an AI model as a required source of truth.
