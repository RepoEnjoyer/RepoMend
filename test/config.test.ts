import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig, writeDefaultConfig } from '../src/config.js';
import { temporaryDirectory } from './helpers.js';

describe('configuration', () => {
  it('creates a default config once', async () => {
    const root = await temporaryDirectory();
    expect(await writeDefaultConfig(root)).toBe(true);
    expect(await writeDefaultConfig(root)).toBe(false);
    expect(JSON.parse(await readFile(join(root, '.repomend.json'), 'utf8'))).toMatchObject({ version: 1 });
  });

  it('rejects unknown config formats', async () => {
    const root = await temporaryDirectory();
    await writeFile(join(root, '.repomend.json'), '{"version":2}', 'utf8');
    await expect(loadConfig(root)).rejects.toThrow('supported version 1');
  });
});
