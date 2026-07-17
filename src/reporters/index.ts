import type { DoctorReport, ReportFormat } from '../types.js';
import { markdownReport } from './markdown.js';
import { prettyReport } from './pretty.js';

export function renderReport(report: DoctorReport, format: ReportFormat): string {
  switch (format) {
    case 'json':
      return `${JSON.stringify(report, null, 2)}\n`;
    case 'markdown':
      return markdownReport(report);
    case 'pretty':
      return prettyReport(report);
  }
}
