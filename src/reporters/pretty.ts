import type { DoctorReport, FindingLevel } from '../types.js';

const symbols: Record<FindingLevel, string> = {
  pass: 'PASS',
  info: 'INFO',
  warn: 'WARN',
  fail: 'FAIL',
};

const colors: Record<FindingLevel, string> = {
  pass: '\u001B[32m',
  info: '\u001B[36m',
  warn: '\u001B[33m',
  fail: '\u001B[31m',
};

function colorize(level: FindingLevel, value: string, color: boolean): string {
  return color ? `${colors[level]}${value}\u001B[0m` : value;
}

export function prettyReport(report: DoctorReport, color = process.stdout.isTTY && !process.env.NO_COLOR): string {
  const lines = [`RepoMend · ${report.repository}`, ''];
  for (const item of report.findings) {
    const label = colorize(item.level, symbols[item.level].padEnd(4), color);
    const location = item.path ? ` · ${item.path}` : '';
    lines.push(`${label}  ${item.title}${location}`);
    lines.push(`      ${item.detail}`);
    if (item.remediation) lines.push(`      Fix: ${item.remediation}`);
  }

  lines.push('');
  lines.push(
    `Summary: ${report.summary.fail} failed · ${report.summary.warn} warnings · ${report.summary.pass} passed · ${report.summary.info} info`,
  );
  lines.push(report.healthy ? 'Result: ready' : 'Result: attention required');
  return `${lines.join('\n')}\n`;
}
