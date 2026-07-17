import type { DoctorReport, FindingLevel } from '../types.js';

const labels: Record<FindingLevel, string> = {
  pass: 'PASS',
  info: 'INFO',
  warn: 'WARN',
  fail: 'FAIL',
};

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function markdownReport(report: DoctorReport): string {
  const lines = [
    '# RepoMend report',
    '',
    `Repository: \`${escapeCell(report.repository)}\``,
    '',
    '| Result | Check | Detail |',
    '| --- | --- | --- |',
  ];
  for (const item of report.findings) {
    const title = item.path ? `${item.title} (${item.path})` : item.title;
    const detail = item.remediation ? `${item.detail} Fix: ${item.remediation}` : item.detail;
    lines.push(`| ${labels[item.level]} | ${escapeCell(title)} | ${escapeCell(detail)} |`);
  }
  lines.push('');
  lines.push(
    `**Summary:** ${report.summary.fail} failed · ${report.summary.warn} warnings · ${report.summary.pass} passed · ${report.summary.info} info`,
  );
  lines.push('');
  lines.push(`**Result:** ${report.healthy ? 'ready' : 'attention required'}`);
  return `${lines.join('\n')}\n`;
}
