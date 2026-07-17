import { join } from 'node:path';
import { pathExists, readTextIfPresent } from '../fs-utils.js';
import { runCommand } from '../shell.js';
import type { Check, Finding } from '../types.js';

interface PackageManifest {
  name?: unknown;
  version?: unknown;
  scripts?: unknown;
  engines?: unknown;
}

const lockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];

function makeFinding(
  id: string,
  level: Finding['level'],
  title: string,
  detail: string,
  remediation?: string,
): Finding {
  return remediation === undefined
    ? { id, level, title, detail }
    : { id, level, title, detail, remediation };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function countNpmProblems(value: unknown): number {
  if (typeof value !== 'object' || value === null) return 0;
  const record = value as Record<string, unknown>;
  const localProblems = Array.isArray(record.problems) ? record.problems.length : 0;
  const dependencies = asRecord(record.dependencies);
  return (
    localProblems +
    Object.values(dependencies).reduce<number>(
      (count, dependency) => count + countNpmProblems(dependency),
      0,
    )
  );
}

export const projectCheck: Check = {
  name: 'Project dependencies',
  async run({ root }) {
    const manifestPath = join(root, 'package.json');
    const raw = await readTextIfPresent(manifestPath);
    if (raw === undefined) {
      return [
        makeFinding(
          'project.detected',
          'info',
          'No Node.js project detected',
          'Node-specific package and script checks were skipped.',
        ),
      ];
    }

    const findings: Finding[] = [
      makeFinding('project.detected', 'pass', 'Node.js project detected', 'A package.json manifest is present.'),
    ];

    let manifest: PackageManifest;
    try {
      manifest = JSON.parse(raw) as PackageManifest;
    } catch {
      return [
        ...findings,
        makeFinding(
          'project.manifest',
          'fail',
          'Invalid package.json',
          'The project manifest is not valid JSON.',
          'Repair package.json before installing dependencies or publishing.',
        ),
      ];
    }

    const metadataComplete = typeof manifest.name === 'string' && typeof manifest.version === 'string';
    findings.push(
      metadataComplete
        ? makeFinding('project.manifest', 'pass', 'Package metadata is complete', 'Package name and version are present.')
        : makeFinding(
            'project.manifest',
            'warn',
            'Package metadata is incomplete',
            'A package name or version is missing.',
            'Add explicit package name and version fields.',
          ),
    );

    const presentLocks: string[] = [];
    for (const lockfile of lockfiles) {
      if (await pathExists(join(root, lockfile))) presentLocks.push(lockfile);
    }
    if (presentLocks.length === 0) {
      findings.push(
        makeFinding(
          'project.lockfile',
          'fail',
          'Dependency lockfile is missing',
          'Reproducible installs require a committed lockfile.',
          'Generate and commit the lockfile for the chosen package manager.',
        ),
      );
    } else if (presentLocks.length > 1) {
      findings.push(
        makeFinding(
          'project.lockfile',
          'fail',
          'Multiple package managers detected',
          `${presentLocks.length} different lockfiles are present.`,
          'Keep only the lockfile used by this project.',
        ),
      );
    } else {
      findings.push(
        makeFinding(
          'project.lockfile',
          'pass',
          'Dependency lockfile detected',
          `${presentLocks[0] ?? 'A lockfile'} defines reproducible dependency versions.`,
        ),
      );
    }

    const scripts = asRecord(manifest.scripts);
    const expectedScripts = ['lint', 'test', 'build'];
    const missingScripts = expectedScripts.filter((name) => typeof scripts[name] !== 'string');
    findings.push(
      missingScripts.length === 0
        ? makeFinding('project.scripts', 'pass', 'Quality scripts are available', 'Lint, test, and build scripts are defined.')
        : makeFinding(
            'project.scripts',
            'warn',
            'Quality scripts are incomplete',
            `${missingScripts.length} expected script${missingScripts.length === 1 ? ' is' : 's are'} missing.`,
            'Define deterministic lint, test, and build commands so CI and contributors use the same checks.',
          ),
    );

    const engines = asRecord(manifest.engines);
    findings.push(
      typeof engines.node === 'string'
        ? makeFinding('project.node-engine', 'pass', 'Node.js support is declared', 'The manifest declares a supported Node.js range.')
        : makeFinding(
            'project.node-engine',
            'warn',
            'Node.js support is unspecified',
            'Contributors and CI cannot tell which Node.js versions are supported.',
            'Add an engines.node range to package.json.',
          ),
    );

    const lifecycleNames = ['preinstall', 'install', 'postinstall'];
    const lifecycle = lifecycleNames.filter((name) => typeof scripts[name] === 'string');
    findings.push(
      lifecycle.length === 0
        ? makeFinding('project.lifecycle', 'pass', 'No install lifecycle scripts', 'Dependency installation does not invoke project lifecycle hooks.')
        : makeFinding(
            'project.lifecycle',
            'warn',
            'Install lifecycle scripts are present',
            `${lifecycle.length} install hook${lifecycle.length === 1 ? '' : 's'} should be reviewed before use.`,
            'Keep install scripts minimal, documented, and free of remote shell execution.',
          ),
    );

    if (presentLocks[0] === 'package-lock.json') {
      const npm = await runCommand(
        'npm',
        ['ls', '--package-lock-only', '--ignore-scripts', '--all', '--json'],
        root,
        { timeoutMs: 30_000, env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' } },
      );
      let parsed: unknown;
      try {
        parsed = JSON.parse(npm.stdout);
      } catch {
        parsed = undefined;
      }
      const problems = countNpmProblems(parsed);
      if (npm.code === 127) {
        findings.push(
          makeFinding(
            'project.peer-dependencies',
            'info',
            'npm dependency check skipped',
            'npm was not available in the current environment.',
          ),
        );
      } else if (npm.ok && problems === 0) {
        findings.push(
          makeFinding(
            'project.peer-dependencies',
            'pass',
            'Locked dependency graph is consistent',
            'npm reported no lockfile or peer-dependency problems without running install scripts.',
          ),
        );
      } else {
        findings.push(
          makeFinding(
            'project.peer-dependencies',
            'fail',
            'Locked dependency graph has problems',
            `${Math.max(problems, 1)} dependency problem${Math.max(problems, 1) === 1 ? '' : 's'} detected without running install scripts.`,
            'Run npm ci in a disposable workspace and resolve the reported peer or lockfile conflict.',
          ),
        );
      }
    }

    return findings;
  },
};
