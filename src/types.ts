export type FindingLevel = 'pass' | 'info' | 'warn' | 'fail';

export interface Finding {
  id: string;
  level: FindingLevel;
  title: string;
  detail: string;
  remediation?: string;
  path?: string;
}

export interface CheckContext {
  root: string;
  config: RepoMendConfig;
  online: boolean;
  signal?: AbortSignal;
}

export interface Check {
  name: string;
  run(context: CheckContext): Promise<Finding[]>;
}

export interface RepoMendConfig {
  version: 1;
  ignore: string[];
  failOnWarnings: boolean;
}

export interface DoctorOptions {
  root: string;
  online?: boolean;
  strict?: boolean;
  signal?: AbortSignal;
}

export interface DoctorReport {
  schemaVersion: 1;
  generatedAt: string;
  repository: string;
  online: boolean;
  findings: Finding[];
  summary: Record<FindingLevel, number>;
  healthy: boolean;
}

export type ReportFormat = 'pretty' | 'json' | 'markdown';

export interface FixOptions {
  root: string;
  apply: boolean;
  githubUser?: string;
}

export interface FixAction {
  id: string;
  title: string;
  detail: string;
  applied: boolean;
}
