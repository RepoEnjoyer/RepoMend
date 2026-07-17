import { lstat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists } from './fs-utils.js';
import { runCommand } from './shell.js';
import type { FixAction, FixOptions } from './types.js';

const safeIgnoreEntries = [
  '.env',
  '.env.*',
  '!.env.example',
  'node_modules/',
  'coverage/',
  '.cache/',
  '*.log',
  '.DS_Store',
  'Thumbs.db',
];

function validGitHubUser(value: string): boolean {
  return /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/u.test(value);
}

async function missingIgnoreEntries(root: string): Promise<{ path: string; entries: string[]; content: string }> {
  const path = join(root, '.gitignore');
  let content = '';
  if (await pathExists(path)) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('Refusing to modify a symlinked .gitignore.');
    content = await readFile(path, 'utf8');
  }
  const normalized = new Set(
    content
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  return { path, content, entries: safeIgnoreEntries.filter((entry) => !normalized.has(entry)) };
}

export async function fixRepository(options: FixOptions): Promise<FixAction[]> {
  const actions: FixAction[] = [];
  const ignore = await missingIgnoreEntries(options.root);
  if (ignore.entries.length > 0) {
    if (options.apply) {
      const prefix = ignore.content.length === 0 || ignore.content.endsWith('\n') ? '' : '\n';
      const section = `${prefix}\n# RepoMend privacy and local-build defaults\n${ignore.entries.join('\n')}\n`;
      await writeFile(ignore.path, `${ignore.content}${section}`, 'utf8');
    }
    actions.push({
      id: 'fix.gitignore',
      title: 'Protect local and environment files',
      detail: `${ignore.entries.length} safe ignore rule${ignore.entries.length === 1 ? '' : 's'} ${options.apply ? 'added' : 'would be added'}.`,
      applied: options.apply,
    });
  }

  if (options.githubUser !== undefined) {
    if (!validGitHubUser(options.githubUser)) {
      throw new Error('GitHub username is invalid.');
    }
    const repository = await runCommand('git', ['rev-parse', '--git-dir'], options.root);
    if (!repository.ok) throw new Error('A Git repository is required to configure a local identity.');
    if (options.apply) {
      const commands = [
        ['config', '--local', 'user.name', options.githubUser],
        ['config', '--local', 'user.email', `${options.githubUser}@users.noreply.github.com`],
        ['config', '--local', 'user.useConfigOnly', 'true'],
      ];
      for (const args of commands) {
        const result = await runCommand('git', args, options.root);
        if (!result.ok) throw new Error('Git refused a local identity update.');
      }
    }
    actions.push({
      id: 'fix.git-identity',
      title: 'Use a repository-local private Git identity',
      detail: options.apply
        ? 'Configured the supplied username with a GitHub noreply address. The address was not displayed.'
        : 'Would configure the supplied username with a GitHub noreply address for this repository only.',
      applied: options.apply,
    });
  }

  return actions;
}

export { safeIgnoreEntries, validGitHubUser };
