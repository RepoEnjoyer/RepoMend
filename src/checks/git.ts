import { pathExists } from '../fs-utils.js';
import { runCommand } from '../shell.js';
import type { Check, Finding } from '../types.js';

function finding(
  id: string,
  level: Finding['level'],
  title: string,
  detail: string,
  remediation?: string,
): Finding {
  return remediation === undefined
    ? { id, level, title, detail }
    : { id, level, title, detail, remediation };
}

function looksPrivateEmail(email: string): boolean {
  return /@users\.noreply\.github\.com$/iu.test(email.trim());
}

function remoteHasCredentials(remote: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\/[^\s/@]+(?::[^\s/@]*)?@/iu.test(remote.trim());
}

export const gitCheck: Check = {
  name: 'Git repository',
  async run({ root }) {
    const findings: Finding[] = [];
    if (!(await pathExists(`${root}/.git`))) {
      return [
        finding(
          'git.repository',
          'fail',
          'Not a Git repository',
          'RepoMend could not find Git metadata at the selected root.',
          'Run RepoMend from a repository root or pass the repository path explicitly.',
        ),
      ];
    }

    findings.push(finding('git.repository', 'pass', 'Git repository detected', 'Local Git metadata is present.'));

    const branch = await runCommand('git', ['symbolic-ref', '--short', '-q', 'HEAD'], root);
    findings.push(
      branch.ok
        ? finding('git.branch', 'pass', 'Attached branch', 'HEAD points to a named local branch.')
        : finding(
            'git.branch',
            'fail',
            'Detached HEAD',
            'Commits created now may be difficult to find later.',
            'Create or switch to a named branch before making changes.',
          ),
    );

    const status = await runCommand('git', ['status', '--porcelain=v1', '-z'], root);
    if (status.ok) {
      const changes = status.stdout.split('\0').filter(Boolean).length;
      findings.push(
        changes === 0
          ? finding('git.worktree', 'pass', 'Working tree is clean', 'No staged, modified, or untracked files were detected.')
          : finding(
              'git.worktree',
              'info',
              'Working tree has changes',
              `${changes} changed or untracked path${changes === 1 ? '' : 's'} detected.`,
              'Review git status before switching branches, fixing, or publishing.',
            ),
      );
    }

    const remote = await runCommand('git', ['remote', 'get-url', 'origin'], root, { redactOutput: false });
    if (!remote.ok) {
      findings.push(
        finding(
          'git.remote',
          'fail',
          'Origin remote is missing',
          'This repository has no origin remote.',
          'Add the intended GitHub repository as origin before pushing.',
        ),
      );
    } else if (remoteHasCredentials(remote.stdout)) {
      findings.push(
        finding(
          'git.remote',
          'fail',
          'Credentials embedded in remote URL',
          'The origin URL appears to contain inline credentials. The value was not displayed.',
          'Replace origin with a credential-free HTTPS or SSH URL and rotate the exposed credential.',
        ),
      );
    } else {
      findings.push(finding('git.remote', 'pass', 'Origin remote is credential-free', 'No inline credentials were detected.'));
    }

    const upstream = await runCommand(
      'git',
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      root,
    );
    if (!upstream.ok) {
      findings.push(
        finding(
          'git.upstream',
          'warn',
          'No upstream branch',
          'The current branch is not tracking a remote branch.',
          'Use git push --set-upstream origin <branch> on the first push.',
        ),
      );
    } else {
      const divergence = await runCommand('git', ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], root);
      const match = /^(\d+)\s+(\d+)$/u.exec(divergence.stdout.trim());
      if (divergence.ok && match) {
        const ahead = Number(match[1]);
        const behind = Number(match[2]);
        const level: Finding['level'] = behind > 0 ? 'warn' : 'pass';
        findings.push(
          finding(
            'git.upstream',
            level,
            behind > 0 ? 'Branch is behind its upstream' : 'Upstream branch is configured',
            `Local branch is ${ahead} commit${ahead === 1 ? '' : 's'} ahead and ${behind} behind the last fetched upstream state.`,
            behind > 0 ? 'Fetch and reconcile upstream changes before pushing.' : undefined,
          ),
        );
      }
    }

    const email = await runCommand('git', ['config', '--get', 'user.email'], root, { redactOutput: false });
    const name = await runCommand('git', ['config', '--get', 'user.name'], root, { redactOutput: false });
    if (!email.ok || !name.ok || !email.stdout.trim() || !name.stdout.trim()) {
      findings.push(
        finding(
          'privacy.git-identity',
          'fail',
          'Git identity is incomplete',
          'An effective Git author name and private email were not both configured. No identity value was displayed.',
          'Run repomend fix --github-user <username> --apply to configure this repository only.',
        ),
      );
    } else if (!looksPrivateEmail(email.stdout)) {
      findings.push(
        finding(
          'privacy.git-identity',
          'fail',
          'Git email is not privacy-protected',
          'The effective Git email is not a GitHub noreply address. The address was not displayed.',
          'Run repomend fix --github-user <username> --apply, then rewrite unpublished commits if necessary.',
        ),
      );
    } else {
      findings.push(
        finding(
          'privacy.git-identity',
          'pass',
          'Git email is privacy-protected',
          'The effective identity uses a GitHub noreply address. The value was not displayed.',
        ),
      );
    }

    const history = await runCommand('git', ['log', '-100', '--format=%ae'], root, { redactOutput: false });
    if (history.ok) {
      const emails = history.stdout.split(/\r?\n/u).filter(Boolean);
      const exposedCount = emails.filter((value) => !looksPrivateEmail(value)).length;
      findings.push(
        exposedCount === 0
          ? finding('privacy.git-history', 'pass', 'Recent commit history is privacy-protected', 'Up to 100 recent commits use noreply author emails.')
          : finding(
              'privacy.git-history',
              'fail',
              'Recent history contains public author metadata',
              `${exposedCount} of ${emails.length} inspected commit${emails.length === 1 ? '' : 's'} use a non-noreply author email. No address was displayed.`,
              'Rewrite unpublished history with a noreply identity. Rewriting shared history requires coordination.',
            ),
      );
    }

    return findings;
  },
};
