import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists } from '../fs-utils.js';
import { runCommand } from '../shell.js';
import type { Check, Finding } from '../types.js';

interface GitHubRepository {
  default_branch?: unknown;
  description?: unknown;
  has_pages?: unknown;
  license?: unknown;
  topics?: unknown;
}

interface WorkflowRuns {
  workflow_runs?: unknown;
}

function parseGitHubSlug(remote: string): string | undefined {
  const trimmed = remote.trim();
  const scp = /^git@github\.com:([^/\s]+\/[^/\s]+?)(?:\.git)?$/iu.exec(trimmed);
  if (scp?.[1]) return scp[1];
  try {
    const url = new URL(trimmed);
    if (url.hostname.toLowerCase() !== 'github.com') return undefined;
    const slug = url.pathname.replace(/^\//u, '').replace(/\.git$/u, '');
    return /^[^/]+\/[^/]+$/u.test(slug) ? slug : undefined;
  } catch {
    return undefined;
  }
}

async function githubJson<T>(path: string, signal?: AbortSignal): Promise<{ status: number; body?: T }> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'RepoMend/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`https://api.github.com${path}`, {
    headers,
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) return { status: response.status };
  return { status: response.status, body: (await response.json()) as T };
}

async function hasPagesWorkflow(root: string): Promise<boolean> {
  const candidates = ['pages.yml', 'pages.yaml', 'deploy-pages.yml', 'deploy-pages.yaml'];
  for (const file of candidates) {
    const path = join(root, '.github', 'workflows', file);
    if (!(await pathExists(path))) continue;
    const content = await readFile(path, 'utf8');
    if (/actions\/deploy-pages@/u.test(content)) return true;
  }
  return false;
}

export const githubCheck: Check = {
  name: 'GitHub publishing',
  async run({ root, online, signal }) {
    if (!online) {
      return [
        {
          id: 'github.online',
          level: 'info',
          title: 'Online GitHub checks are off',
          detail: 'Use --online to inspect public repository metadata, Pages state, and Actions for the current commit.',
        },
      ];
    }

    const remote = await runCommand('git', ['remote', 'get-url', 'origin'], root, { redactOutput: false });
    const slug = remote.ok ? parseGitHubSlug(remote.stdout) : undefined;
    if (!slug) {
      return [
        {
          id: 'github.online',
          level: 'warn',
          title: 'GitHub repository could not be resolved',
          detail: 'The credential-free origin URL did not identify a github.com repository.',
          remediation: 'Confirm origin points to the intended GitHub repository.',
        },
      ];
    }

    try {
      const repository = await githubJson<GitHubRepository>(`/repos/${slug}`, signal);
      if (repository.status !== 200 || !repository.body) {
        return [
          {
            id: 'github.online',
            level: 'warn',
            title: 'GitHub metadata was unavailable',
            detail: `GitHub returned status ${repository.status}. No response content was displayed.`,
            remediation: 'Retry later or provide a read-only GITHUB_TOKEN for private repositories and higher rate limits.',
          },
        ];
      }

      const body = repository.body;
      const findings: Finding[] = [
        {
          id: 'github.online',
          level: 'pass',
          title: 'GitHub repository resolved',
          detail: 'Public repository metadata was retrieved without uploading local files.',
        },
        typeof body.description === 'string' && body.description.trim()
          ? {
              id: 'github.description',
              level: 'pass',
              title: 'Repository description is set',
              detail: 'The GitHub About description is non-empty.',
            }
          : {
              id: 'github.description',
              level: 'warn',
              title: 'Repository description is missing',
              detail: 'The GitHub About section does not explain the project.',
              remediation: 'Add a concise, searchable one-sentence description.',
            },
        body.license
          ? {
              id: 'github.license',
              level: 'pass',
              title: 'GitHub recognizes the licence',
              detail: 'Repository licence metadata is available.',
            }
          : {
              id: 'github.license',
              level: 'warn',
              title: 'GitHub does not recognize a licence',
              detail: 'The repository licence may be missing or use an unrecognized filename.',
              remediation: 'Use a standard licence file at the repository root.',
            },
        Array.isArray(body.topics) && body.topics.length > 0
          ? {
              id: 'github.topics',
              level: 'pass',
              title: 'Repository topics are configured',
              detail: `${body.topics.length} searchable topic${body.topics.length === 1 ? '' : 's'} detected.`,
            }
          : {
              id: 'github.topics',
              level: 'warn',
              title: 'Repository topics are missing',
              detail: 'The project is harder to discover through GitHub topics.',
              remediation: 'Add a small set of accurate technology and use-case topics.',
            },
      ];

      if ((await hasPagesWorkflow(root)) && body.has_pages !== true) {
        findings.push({
          id: 'github.pages',
          level: 'fail',
          title: 'Pages workflow exists but Pages is disabled',
          detail: 'The deployment source and repository setting disagree.',
          remediation: 'Enable GitHub Pages with GitHub Actions as the source, then run the deployment workflow.',
        });
      } else {
        findings.push({
          id: 'github.pages',
          level: 'pass',
          title: body.has_pages === true ? 'GitHub Pages is enabled' : 'No inactive Pages workflow detected',
          detail: body.has_pages === true ? 'GitHub reports an active Pages site.' : 'Local workflow state does not require Pages.',
        });
      }

      const head = await runCommand('git', ['rev-parse', 'HEAD'], root);
      if (head.ok && /^[a-f0-9]{40}$/iu.test(head.stdout.trim())) {
        const runs = await githubJson<WorkflowRuns>(
          `/repos/${slug}/actions/runs?head_sha=${head.stdout.trim()}&per_page=20`,
          signal,
        );
        const values = Array.isArray(runs.body?.workflow_runs)
          ? (runs.body.workflow_runs as Array<Record<string, unknown>>)
          : [];
        const pushRuns = values.filter((run) => run.event === 'push');
        if (pushRuns.length === 0) {
          findings.push({
            id: 'github.actions',
            level: 'warn',
            title: 'No push workflow found for current commit',
            detail: 'GitHub Actions has not reported a push run for local HEAD.',
            remediation: 'Push the current commit and confirm the CI workflow starts.',
          });
        } else if (pushRuns.some((run) => run.status === 'completed' && run.conclusion === 'success')) {
          findings.push({
            id: 'github.actions',
            level: 'pass',
            title: 'Current commit has a successful push workflow',
            detail: 'At least one GitHub Actions push run completed successfully.',
          });
        } else if (pushRuns.some((run) => run.status !== 'completed')) {
          findings.push({
            id: 'github.actions',
            level: 'info',
            title: 'Workflow is still running',
            detail: 'A push workflow for the current commit has not completed yet.',
          });
        } else {
          findings.push({
            id: 'github.actions',
            level: 'fail',
            title: 'Current commit has a failed push workflow',
            detail: 'The latest completed push workflow did not succeed.',
            remediation: 'Inspect the failed job logs and reproduce the command locally before pushing another fix.',
          });
        }
      }

      return findings;
    } catch (error) {
      const detail = error instanceof Error && error.name === 'AbortError' ? 'The request was cancelled.' : 'The GitHub request failed.';
      return [
        {
          id: 'github.online',
          level: 'warn',
          title: 'GitHub online checks failed safely',
          detail,
          remediation: 'Check connectivity and retry. Local checks are unaffected.',
        },
      ];
    }
  },
};

export { parseGitHubSlug };
