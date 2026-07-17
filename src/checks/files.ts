import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { isInsideRoot } from '../fs-utils.js';
import { runCommand } from '../shell.js';
import type { Check, Finding } from '../types.js';

const forbiddenPatterns = [
  /(^|\/)\.env(?:\.|$)/u,
  /(^|\/)node_modules\//u,
  /(^|\/)(?:\.cache|\.pytest_cache|__pycache__)\//u,
  /(^|\/)\.DS_Store$/u,
  /(^|\/)Thumbs\.db$/iu,
];

function parseTrackedFiles(value: string): string[] {
  return value.split('\0').filter(Boolean);
}

export const filesCheck: Check = {
  name: 'Tracked files',
  async run({ root }) {
    const tracked = await runCommand('git', ['ls-files', '-z'], root);
    if (!tracked.ok) {
      return [
        {
          id: 'files.tracked',
          level: 'info',
          title: 'Tracked-file checks skipped',
          detail: 'RepoMend could not read the Git index.',
        },
      ];
    }

    const files = parseTrackedFiles(tracked.stdout);
    const forbidden = files.filter((file) => forbiddenPatterns.some((pattern) => pattern.test(file)));
    const folded = new Map<string, string[]>();
    for (const file of files) {
      const key = file.toLocaleLowerCase('en-US');
      const group = folded.get(key) ?? [];
      group.push(file);
      folded.set(key, group);
    }
    const caseCollisions = [...folded.values()].filter((group) => new Set(group).size > 1).length;

    let largeFiles = 0;
    let externalSymlinks = 0;
    for (const file of files) {
      const absolute = join(root, file);
      try {
        const stat = await lstat(absolute);
        if (stat.size > 10 * 1024 * 1024) largeFiles += 1;
        if (stat.isSymbolicLink()) {
          const resolved = await realpath(absolute);
          if (!isInsideRoot(root, resolved)) externalSymlinks += 1;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }

    const findings: Finding[] = [
      forbidden.length === 0
        ? {
            id: 'files.forbidden',
            level: 'pass',
            title: 'No forbidden generated or environment files are tracked',
            detail: `${files.length} tracked path${files.length === 1 ? '' : 's'} inspected.`,
          }
        : {
            id: 'files.forbidden',
            level: 'fail',
            title: 'Unsafe or generated files are tracked',
            detail: `${forbidden.length} tracked path${forbidden.length === 1 ? '' : 's'} match a protected pattern. Names were not displayed.`,
            remediation: 'Remove the files from Git, add appropriate ignore rules, and rotate any exposed credentials.',
          },
      caseCollisions === 0
        ? {
            id: 'files.case-collisions',
            level: 'pass',
            title: 'Tracked paths are cross-platform safe',
            detail: 'No case-only filename collisions were found.',
          }
        : {
            id: 'files.case-collisions',
            level: 'fail',
            title: 'Case-only filename collisions detected',
            detail: `${caseCollisions} collision${caseCollisions === 1 ? '' : 's'} may fail on case-insensitive filesystems.`,
            remediation: 'Rename colliding files so each path is distinct when lowercased.',
          },
      largeFiles === 0
        ? {
            id: 'files.large',
            level: 'pass',
            title: 'No oversized tracked files',
            detail: 'No tracked file exceeds 10 MiB.',
          }
        : {
            id: 'files.large',
            level: 'warn',
            title: 'Large files are tracked',
            detail: `${largeFiles} tracked file${largeFiles === 1 ? '' : 's'} exceed 10 MiB. Names were not displayed.`,
            remediation: 'Confirm each binary is required or use a release asset or Git LFS.',
          },
      externalSymlinks === 0
        ? {
            id: 'files.symlinks',
            level: 'pass',
            title: 'Tracked symlinks stay inside the repository',
            detail: 'No tracked symlink resolves outside the project root.',
          }
        : {
            id: 'files.symlinks',
            level: 'fail',
            title: 'Tracked symlinks escape the repository',
            detail: `${externalSymlinks} symlink${externalSymlinks === 1 ? '' : 's'} resolve to external paths. Targets were not displayed.`,
            remediation: 'Replace external symlinks with documented, repository-contained inputs.',
          },
    ];

    return findings;
  },
};
