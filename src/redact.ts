import { homedir } from 'node:os';
import { resolve } from 'node:path';

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const credentialUrlPattern = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+(?::[^\s/@]*)?@/giu;
const tokenPattern = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/gu;
const windowsUserPathPattern = /[A-Za-z]:\\Users\\[^\\\s]+/gu;
const unixUserPathPattern = /\/(?:home|Users)\/[^/\s]+/gu;

export function redact(value: string, root?: string): string {
  let result = value;
  const replacements = [root ? resolve(root) : undefined, homedir()].filter(
    (item): item is string => Boolean(item),
  );

  for (const sensitivePath of replacements) {
    result = result.split(sensitivePath).join('<private-path>');
  }

  return result
    .replace(credentialUrlPattern, '$1<credentials>@')
    .replace(emailPattern, '<private-email>')
    .replace(tokenPattern, '<redacted-token>')
    .replace(windowsUserPathPattern, '<private-path>')
    .replace(unixUserPathPattern, '<private-path>');
}

export function safeRelativePath(value: string): string {
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//u, '');
  return normalized.startsWith('../') || normalized.startsWith('/') ? '<outside-repository>' : normalized;
}
