import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli.js';

describe('parseArgs', () => {
  it('parses doctor options', () => {
    expect(parseArgs(['doctor', './repo', '--online', '--strict', '--format', 'json'])).toMatchObject({
      command: 'doctor',
      path: './repo',
      online: true,
      strict: true,
      format: 'json',
    });
  });

  it('keeps fixes dry-run by default', () => {
    expect(parseArgs(['fix', '--github-user', 'RepoEnjoyer'])).toMatchObject({
      command: 'fix',
      apply: false,
      githubUser: 'RepoEnjoyer',
    });
  });

  it('rejects unknown options', () => {
    expect(() => parseArgs(['--surprise'])).toThrow('Unknown option');
  });
});
