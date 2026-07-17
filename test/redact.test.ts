import { homedir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { redact, safeRelativePath } from '../src/redact.js';

describe('redact', () => {
  it('removes identities, credentials, tokens, and home paths', () => {
    const syntheticToken = `gh${'p_'}${'x'.repeat(36)}`;
    const input = [
      'person@example.net',
      'https://user:secret@github.com/example/project.git',
      syntheticToken,
      `${homedir()}/project`,
      'C:\\Users\\PrivateUser\\project',
    ].join(' ');
    const output = redact(input);

    expect(output).not.toContain('person@example.net');
    expect(output).not.toContain('secret');
    expect(output).not.toContain(syntheticToken);
    expect(output).not.toContain('PrivateUser');
    expect(output).toContain('<private-email>');
    expect(output).toContain('<redacted-token>');
  });

  it('refuses to present paths outside a repository', () => {
    expect(safeRelativePath('../private')).toBe('<outside-repository>');
    expect(safeRelativePath('docs/guide.md')).toBe('docs/guide.md');
  });
});
