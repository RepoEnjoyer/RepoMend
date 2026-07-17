import { spawn } from 'node:child_process';
import { redact } from './redact.js';

export interface CommandResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  options: { timeoutMs?: number; env?: NodeJS.ProcessEnv; redactOutput?: boolean } = {},
): Promise<CommandResult> {
  return await new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd,
      env: options.env ?? process.env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (result: CommandResult): void => {
      if (settled) return;
      settled = true;
      resolvePromise(result);
    };

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    const clean = (value: string): string => (options.redactOutput === false ? value : redact(value, cwd));

    child.on('error', (error) => {
      finish({ ok: false, code: 127, stdout: clean(stdout), stderr: clean(error.message) });
    });
    child.on('close', (code) => {
      const exitCode = code ?? 1;
      finish({
        ok: exitCode === 0,
        code: exitCode,
        stdout: clean(stdout),
        stderr: clean(stderr),
      });
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      finish({
        ok: false,
        code: 124,
        stdout: clean(stdout),
        stderr: 'Command timed out.',
      });
    }, options.timeoutMs ?? 15_000);
    timeout.unref();
    child.on('close', () => clearTimeout(timeout));
  });
}
