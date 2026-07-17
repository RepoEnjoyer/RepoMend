import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathExists } from '../fs-utils.js';
import type { Check, Finding } from '../types.js';

const workflowExtensions = new Set(['.yml', '.yaml']);

function extension(path: string): string {
  const index = path.lastIndexOf('.');
  return index < 0 ? '' : path.slice(index);
}

function finding(
  id: string,
  level: Finding['level'],
  title: string,
  detail: string,
  path?: string,
  remediation?: string,
): Finding {
  return {
    id,
    level,
    title,
    detail,
    ...(path === undefined ? {} : { path }),
    ...(remediation === undefined ? {} : { remediation }),
  };
}

function referencedActions(content: string): Array<{ action: string; ref: string }> {
  return [...content.matchAll(/^\s*-?\s*uses:\s*['"]?([^@\s'"]+)@([^\s#'"]+)/gmu)].map((match) => ({
    action: match[1] ?? '',
    ref: match[2] ?? '',
  }));
}

function hasDangerousInterpolation(content: string): boolean {
  const runBlocks = content.match(/^\s*run:\s*.*(?:\n(?:\s{4,}.*)?)*$/gmu) ?? [];
  return runBlocks.some((block) => /\$\{\{\s*github\.event\./u.test(block));
}

export const workflowCheck: Check = {
  name: 'GitHub Actions',
  async run({ root }) {
    const directory = join(root, '.github', 'workflows');
    if (!(await pathExists(directory))) {
      return [
        finding(
          'workflow.present',
          'warn',
          'No GitHub Actions workflows',
          'Pushes and pull requests are not automatically verified.',
          undefined,
          'Add a workflow that installs dependencies and runs the project quality checks.',
        ),
      ];
    }

    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && workflowExtensions.has(extension(entry.name)))
      .map((entry) => entry.name)
      .sort();
    if (files.length === 0) {
      return [finding('workflow.present', 'warn', 'Workflow directory is empty', 'No YAML workflow files were found.')];
    }

    const findings: Finding[] = [
      finding(
        'workflow.present',
        'pass',
        'GitHub Actions configured',
        `${files.length} workflow file${files.length === 1 ? '' : 's'} detected.`,
      ),
    ];

    let unpinned = 0;
    let hasPermissions = true;
    let dangerousInterpolation = 0;
    let writeAll = 0;
    let remoteShell = 0;

    for (const file of files) {
      const relativePath = `.github/workflows/${basename(file)}`;
      const content = await readFile(join(directory, file), 'utf8');
      if (!/^permissions\s*:/mu.test(content)) hasPermissions = false;
      if (/^\s*permissions\s*:\s*write-all\s*$/gmu.test(content)) writeAll += 1;
      if (hasDangerousInterpolation(content)) dangerousInterpolation += 1;
      if (/(?:curl|wget)[^\n|]*\|\s*(?:ba)?sh\b/iu.test(content)) remoteShell += 1;

      for (const reference of referencedActions(content)) {
        if (reference.action.startsWith('./')) continue;
        if (!/^[a-f0-9]{40}$/iu.test(reference.ref)) unpinned += 1;
      }

      if (/\bpull_request_target\s*:/u.test(content)) {
        findings.push(
          finding(
            `workflow.pull-request-target.${file}`,
            'warn',
            'Privileged pull_request_target trigger',
            'This trigger can expose write permissions or secrets to unsafe workflow logic.',
            relativePath,
            'Avoid checking out untrusted pull-request code in this workflow.',
          ),
        );
      }
      if (/\bsecrets\s*:\s*inherit\b/u.test(content)) {
        findings.push(
          finding(
            `workflow.inherited-secrets.${file}`,
            'warn',
            'Workflow inherits all available secrets',
            'Reusable workflow access is broader than necessary.',
            relativePath,
            'Pass only the individual secrets required by the called workflow.',
          ),
        );
      }
    }

    findings.push(
      hasPermissions
        ? finding('workflow.permissions', 'pass', 'Workflow permissions are explicit', 'Every workflow declares a permissions policy.')
        : finding(
            'workflow.permissions',
            'warn',
            'Workflow permissions are implicit',
            'At least one workflow relies on repository defaults.',
            undefined,
            'Declare least-privilege permissions in every workflow.',
          ),
    );
    findings.push(
      writeAll === 0
        ? finding('workflow.write-all', 'pass', 'No write-all permissions', 'No workflow requests blanket write access.')
        : finding(
            'workflow.write-all',
            'fail',
            'Workflow requests write-all',
            `${writeAll} workflow${writeAll === 1 ? '' : 's'} request blanket write access.`,
            undefined,
            'Replace write-all with the smallest required permission set.',
          ),
    );
    findings.push(
      dangerousInterpolation === 0
        ? finding('workflow.interpolation', 'pass', 'No direct event interpolation in shell steps', 'Untrusted event fields were not directly embedded in run blocks.')
        : finding(
            'workflow.interpolation',
            'fail',
            'Untrusted event data reaches a shell step',
            `${dangerousInterpolation} workflow${dangerousInterpolation === 1 ? '' : 's'} directly interpolate event data into a run block.`,
            undefined,
            'Assign the value to an environment variable and quote it inside the shell.',
          ),
    );
    findings.push(
      remoteShell === 0
        ? finding('workflow.remote-shell', 'pass', 'No remote shell pipelines', 'Workflows do not pipe downloads directly into a shell.')
        : finding(
            'workflow.remote-shell',
            'fail',
            'Remote content is piped into a shell',
            `${remoteShell} workflow${remoteShell === 1 ? '' : 's'} contain an unsafe download-and-execute pattern.`,
            undefined,
            'Download a versioned artifact, verify its checksum, then execute it separately.',
          ),
    );
    findings.push(
      unpinned === 0
        ? finding('workflow.action-pins', 'pass', 'Third-party actions are commit-pinned', 'External actions use immutable commit references.')
        : finding(
            'workflow.action-pins',
            'warn',
            'Actions use mutable references',
            `${unpinned} external action reference${unpinned === 1 ? '' : 's'} use a tag or branch.`,
            undefined,
            'Pin external actions to full commit SHAs and retain the release tag in a comment.',
          ),
    );

    return findings;
  },
};
