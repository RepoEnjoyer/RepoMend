import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixRepository, validGitHubUser } from '../src/fix.js';
import { git, initializeRepository, temporaryDirectory } from './helpers.js';

describe('fixRepository', () => {
  it('does not mutate during a dry run', async () => {
    const root = await temporaryDirectory();
    await initializeRepository(root);

    const actions = await fixRepository({ root, apply: false, githubUser: 'RepoEnjoyer' });

    expect(actions.every((action) => !action.applied)).toBe(true);
    await expect(readFile(join(root, '.gitignore'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('applies idempotent ignore rules and a private local identity', async () => {
    const root = await temporaryDirectory();
    await initializeRepository(root);

    await fixRepository({ root, apply: true, githubUser: 'RepoEnjoyer' });
    const second = await fixRepository({ root, apply: true, githubUser: 'RepoEnjoyer' });
    const ignore = await readFile(join(root, '.gitignore'), 'utf8');

    expect(ignore.match(/^\.env$/gmu)).toHaveLength(1);
    expect(await git(root, 'config', '--local', 'user.name')).toBe('RepoEnjoyer');
    expect(await git(root, 'config', '--local', 'user.email')).toMatch(/@users\.noreply\.github\.com$/u);
    expect(second.some((action) => action.id === 'fix.gitignore')).toBe(false);
  });

  it('validates GitHub usernames', () => {
    expect(validGitHubUser('RepoEnjoyer')).toBe(true);
    expect(validGitHubUser('-invalid')).toBe(false);
    expect(validGitHubUser('bad--name')).toBe(false);
  });
});
