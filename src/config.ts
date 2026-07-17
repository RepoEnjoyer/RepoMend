import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RepoMendConfig } from './types.js';

export const configFileName = '.repomend.json';

export const defaultConfig: RepoMendConfig = {
  version: 1,
  ignore: [],
  failOnWarnings: false,
};

function isConfig(value: unknown): value is RepoMendConfig {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.ignore) &&
    candidate.ignore.every((item) => typeof item === 'string') &&
    typeof candidate.failOnWarnings === 'boolean'
  );
}

export async function loadConfig(root: string): Promise<RepoMendConfig> {
  try {
    const raw = await readFile(join(root, configFileName), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isConfig(parsed)) {
      throw new Error(`${configFileName} does not match the supported version 1 format.`);
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...defaultConfig, ignore: [] };
    throw error;
  }
}

export async function writeDefaultConfig(root: string): Promise<boolean> {
  const path = join(root, configFileName);
  try {
    await readFile(path, 'utf8');
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  await writeFile(path, `${JSON.stringify(defaultConfig, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return true;
}
