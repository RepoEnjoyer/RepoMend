import { basename, resolve } from 'node:path';
import { communityCheck } from './checks/community.js';
import { docsCheck } from './checks/docs.js';
import { filesCheck } from './checks/files.js';
import { gitCheck } from './checks/git.js';
import { githubCheck } from './checks/github.js';
import { projectCheck } from './checks/project.js';
import { workflowCheck } from './checks/workflows.js';
import { loadConfig } from './config.js';
import type { Check, DoctorOptions, DoctorReport, Finding, FindingLevel } from './types.js';

const checks: Check[] = [gitCheck, filesCheck, projectCheck, workflowCheck, docsCheck, communityCheck, githubCheck];

function summarize(findings: Finding[]): Record<FindingLevel, number> {
  return findings.reduce<Record<FindingLevel, number>>(
    (summary, item) => {
      summary[item.level] += 1;
      return summary;
    },
    { pass: 0, info: 0, warn: 0, fail: 0 },
  );
}

export async function doctor(options: DoctorOptions): Promise<DoctorReport> {
  const root = resolve(options.root);
  const config = await loadConfig(root);
  const ignored = new Set(config.ignore);
  const findings: Finding[] = [];

  for (const check of checks) {
    const result = await check.run({
      root,
      config,
      online: options.online ?? false,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    findings.push(...result.filter((item) => !ignored.has(item.id)));
  }

  const summary = summarize(findings);
  const strict = options.strict ?? config.failOnWarnings;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repository: basename(root) || '.',
    online: options.online ?? false,
    findings,
    summary,
    healthy: summary.fail === 0 && (!strict || summary.warn === 0),
  };
}

export { summarize };
