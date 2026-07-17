import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists } from '../fs-utils.js';
import type { Check, Finding } from '../types.js';

interface ExpectedPath {
  id: string;
  label: string;
  alternatives: string[];
  level: 'fail' | 'warn';
}

const expectedPaths: ExpectedPath[] = [
  { id: 'readme', label: 'README', alternatives: ['README.md', 'README'], level: 'fail' },
  { id: 'license', label: 'licence', alternatives: ['LICENSE', 'LICENSE.md'], level: 'fail' },
  { id: 'security', label: 'security policy', alternatives: ['SECURITY.md', '.github/SECURITY.md'], level: 'warn' },
  { id: 'contributing', label: 'contribution guide', alternatives: ['CONTRIBUTING.md', '.github/CONTRIBUTING.md'], level: 'warn' },
  { id: 'changelog', label: 'changelog', alternatives: ['CHANGELOG.md'], level: 'warn' },
  { id: 'code-of-conduct', label: 'code of conduct', alternatives: ['CODE_OF_CONDUCT.md', '.github/CODE_OF_CONDUCT.md'], level: 'warn' },
  { id: 'pull-request-template', label: 'pull request template', alternatives: ['.github/PULL_REQUEST_TEMPLATE.md'], level: 'warn' },
  { id: 'dependabot', label: 'Dependabot configuration', alternatives: ['.github/dependabot.yml', '.github/dependabot.yaml'], level: 'warn' },
];

async function anyPathExists(root: string, paths: string[]): Promise<boolean> {
  for (const path of paths) {
    if (await pathExists(join(root, path))) return true;
  }
  return false;
}

export const communityCheck: Check = {
  name: 'Community health',
  async run({ root }) {
    const findings: Finding[] = [];
    for (const item of expectedPaths) {
      const present = await anyPathExists(root, item.alternatives);
      findings.push(
        present
          ? {
              id: `community.${item.id}`,
              level: 'pass',
              title: `${item.label[0]?.toUpperCase() ?? ''}${item.label.slice(1)} is present`,
              detail: `A repository ${item.label} was detected.`,
            }
          : {
              id: `community.${item.id}`,
              level: item.level,
              title: `${item.label[0]?.toUpperCase() ?? ''}${item.label.slice(1)} is missing`,
              detail: `The repository does not include a ${item.label}.`,
              remediation: `Add a concise ${item.label} before the next public release.`,
            },
      );
    }

    const issueTemplateDirectory = join(root, '.github', 'ISSUE_TEMPLATE');
    let hasIssueTemplate = false;
    if (await pathExists(issueTemplateDirectory)) {
      const entries = await readdir(issueTemplateDirectory, { withFileTypes: true });
      hasIssueTemplate = entries.some(
        (entry) => entry.isFile() && /\.(?:md|ya?ml)$/iu.test(entry.name) && entry.name !== 'config.yml',
      );
    }
    findings.push(
      hasIssueTemplate
        ? {
            id: 'community.issue-template',
            level: 'pass',
            title: 'Issue templates are present',
            detail: 'Contributors receive structured guidance when opening issues.',
          }
        : {
            id: 'community.issue-template',
            level: 'warn',
            title: 'Issue templates are missing',
            detail: 'New issues may omit reproduction details.',
            remediation: 'Add at least a bug report issue form.',
          },
    );

    return findings;
  },
};
