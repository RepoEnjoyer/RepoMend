import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/reporters/index.js';
import type { DoctorReport } from '../src/types.js';

const report: DoctorReport = {
  schemaVersion: 1,
  generatedAt: '2026-07-17T00:00:00.000Z',
  repository: 'RepoMend',
  online: false,
  findings: [
    { id: 'example', level: 'warn', title: 'Example warning', detail: 'A useful explanation.', remediation: 'Fix it.' },
  ],
  summary: { pass: 0, info: 0, warn: 1, fail: 0 },
  healthy: true,
};

describe('reporters', () => {
  it('renders deterministic JSON', () => {
    expect(JSON.parse(renderReport(report, 'json'))).toMatchObject({ repository: 'RepoMend' });
  });

  it('renders Markdown findings', () => {
    const markdown = renderReport(report, 'markdown');
    expect(markdown).toContain('| WARN | Example warning |');
    expect(markdown).toContain('Fix: Fix it.');
  });
});
