import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workflowCheck } from '../src/checks/workflows.js';
import { defaultConfig } from '../src/config.js';
import { temporaryDirectory } from './helpers.js';

describe('workflowCheck', () => {
  it('accepts explicit permissions and immutable action references', async () => {
    const root = await temporaryDirectory();
    await mkdir(join(root, '.github', 'workflows'), { recursive: true });
    await writeFile(
      join(root, '.github', 'workflows', 'ci.yml'),
      'name: CI\non: [push]\npermissions:\n  contents: read\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10\n      - run: npm test\n',
      'utf8',
    );

    const findings = await workflowCheck.run({ root, config: defaultConfig, online: false });
    const byId = new Map(findings.map((item) => [item.id, item]));
    expect(byId.get('workflow.permissions')?.level).toBe('pass');
    expect(byId.get('workflow.action-pins')?.level).toBe('pass');
    expect(byId.get('workflow.remote-shell')?.level).toBe('pass');
  });
});
