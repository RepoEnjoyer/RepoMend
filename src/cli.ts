#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDefaultConfig } from './config.js';
import { doctor } from './doctor.js';
import { fixRepository } from './fix.js';
import { redact } from './redact.js';
import { renderReport } from './reporters/index.js';
import type { ReportFormat } from './types.js';

const version = '1.0.0';

interface ParsedArgs {
  command: 'doctor' | 'fix' | 'init' | 'help' | 'version';
  path: string;
  online: boolean;
  strict: boolean;
  format: ReportFormat;
  output?: string;
  apply: boolean;
  githubUser?: string;
}

const help = `RepoMend ${version}

Privacy-safe repository diagnostics and explicit, reversible fixes.

Usage:
  repomend [doctor] [path] [--online] [--strict] [--format pretty|json|markdown]
  repomend fix [path] [--github-user USERNAME] [--apply]
  repomend init [path]
  repomend --help

Options:
  --online                Read public GitHub metadata and Actions state.
  --strict                Treat warnings as an unsuccessful result.
  --format FORMAT         Output pretty text, JSON, or Markdown.
  --output FILE           Write the report to a file instead of stdout.
  --github-user USERNAME  Prepare a repository-local noreply Git identity.
  --apply                 Apply fix actions. Fix is a dry-run without this flag.
  --help                   Show this help.
  --version                Show the version.

Privacy:
  RepoMend never displays Git emails, credential-bearing remotes, home paths,
  tokens, or external symlink targets. Online checks are opt-in.
`;

function takeValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value.`);
  return value;
}

export function parseArgs(args: string[]): ParsedArgs {
  let command: ParsedArgs['command'] = 'doctor';
  let path = '.';
  let online = false;
  let strict = false;
  let format: ReportFormat = 'pretty';
  let output: string | undefined;
  let apply = false;
  let githubUser: string | undefined;
  let pathSeen = false;
  let commandSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (arg === '--help' || arg === '-h') return { command: 'help', path, online, strict, format, apply };
    if (arg === '--version' || arg === '-v') return { command: 'version', path, online, strict, format, apply };
    if (!commandSeen && ['doctor', 'fix', 'init'].includes(arg)) {
      command = arg as ParsedArgs['command'];
      commandSeen = true;
      continue;
    }
    if (arg === '--online') {
      online = true;
      continue;
    }
    if (arg === '--strict') {
      strict = true;
      continue;
    }
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    if (arg === '--format') {
      const value = takeValue(args, index, arg);
      if (!['pretty', 'json', 'markdown'].includes(value)) throw new Error('Unsupported report format.');
      format = value as ReportFormat;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      output = takeValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--github-user') {
      githubUser = takeValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    if (pathSeen) throw new Error('Only one repository path may be provided.');
    path = arg;
    pathSeen = true;
  }

  return {
    command,
    path,
    online,
    strict,
    format,
    ...(output === undefined ? {} : { output }),
    apply,
    ...(githubUser === undefined ? {} : { githubUser }),
  };
}

export async function runCli(args: string[]): Promise<number> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(args);
  } catch (error) {
    process.stderr.write(`RepoMend: ${redact(error instanceof Error ? error.message : 'Invalid arguments.')}\n`);
    process.stderr.write('Run repomend --help for usage.\n');
    return 2;
  }

  if (parsed.command === 'help') {
    process.stdout.write(help);
    return 0;
  }
  if (parsed.command === 'version') {
    process.stdout.write(`${version}\n`);
    return 0;
  }

  const root = resolve(parsed.path);
  try {
    if (parsed.command === 'init') {
      const created = await writeDefaultConfig(root);
      process.stdout.write(created ? 'Created .repomend.json.\n' : '.repomend.json already exists; no changes made.\n');
      return 0;
    }

    if (parsed.command === 'fix') {
      const actions = await fixRepository({
        root,
        apply: parsed.apply,
        ...(parsed.githubUser === undefined ? {} : { githubUser: parsed.githubUser }),
      });
      if (actions.length === 0) {
        process.stdout.write('No safe fixes are currently available.\n');
        return 0;
      }
      process.stdout.write(parsed.apply ? 'Applied fixes:\n' : 'Dry run — no files or Git settings changed:\n');
      for (const action of actions) process.stdout.write(`- ${action.title}: ${action.detail}\n`);
      if (!parsed.apply) process.stdout.write('Run the same command with --apply after reviewing these actions.\n');
      return 0;
    }

    const controller = new AbortController();
    process.once('SIGINT', () => controller.abort());
    const report = await doctor({
      root,
      online: parsed.online,
      strict: parsed.strict,
      signal: controller.signal,
    });
    const rendered = renderReport(report, parsed.format);
    if (parsed.output) {
      await writeFile(resolve(parsed.output), rendered, 'utf8');
      process.stdout.write('Report written successfully.\n');
    } else {
      process.stdout.write(rendered);
    }
    return report.healthy ? 0 : 1;
  } catch (error) {
    process.stderr.write(
      `RepoMend stopped safely: ${redact(error instanceof Error ? error.message : 'Unexpected error.', root)}\n`,
    );
    return 2;
  }
}

function isDirectExecution(): boolean {
  if (process.argv[1] === undefined) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
  }
}

const isDirect = isDirectExecution();
if (isDirect) {
  process.exitCode = await runCli(process.argv.slice(2));
}

export { help, version };
