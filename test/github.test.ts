import { describe, expect, it } from 'vitest';
import { parseGitHubSlug } from '../src/checks/github.js';

describe('parseGitHubSlug', () => {
  it.each([
    ['https://github.com/RepoEnjoyer/RepoMend.git', 'RepoEnjoyer/RepoMend'],
    ['git@github.com:RepoEnjoyer/RepoMend.git', 'RepoEnjoyer/RepoMend'],
    ['ssh://git@github.com/RepoEnjoyer/RepoMend.git', 'RepoEnjoyer/RepoMend'],
  ])('parses %s', (remote, expected) => {
    expect(parseGitHubSlug(remote)).toBe(expected);
  });

  it('rejects non-GitHub remotes', () => {
    expect(parseGitHubSlug('https://code.example.net/group/project.git')).toBeUndefined();
  });
});
