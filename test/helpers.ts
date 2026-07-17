import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function temporaryDirectory(prefix = 'repomend-test-'): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix));
}

export async function git(root: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, { cwd: root, encoding: 'utf8' });
  return result.stdout.trim();
}

export async function initializeRepository(root: string): Promise<void> {
  await git(root, 'init', '-b', 'main');
  await git(root, 'config', 'user.name', 'RepoEnjoyer');
  await git(root, 'config', 'user.email', 'RepoEnjoyer@users.noreply.github.com');
  await writeFile(join(root, 'README.md'), '# Fixture\n', 'utf8');
  await git(root, 'add', 'README.md');
  await git(root, 'commit', '-m', 'test: initialize fixture');
}
