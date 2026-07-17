import { dirname, extname, isAbsolute, join, normalize } from 'node:path';
import { pathExists, readTextIfPresent } from '../fs-utils.js';
import { safeRelativePath } from '../redact.js';
import type { Check, Finding } from '../types.js';

const markdownLinkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gu;
const privatePathPattern = /(?:[A-Za-z]:\\Users\\|\/(?:Users|home)\/)[^\s)`"']+/gu;
const placeholderPattern = /\b(?:TODO|TBD|YOUR[_ -]?(?:USERNAME|NAME)|example\.com)\b/giu;

function isExternal(target: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|#)/iu.test(target);
}

function stripTarget(target: string): string {
  const withoutFragment = target.split('#', 1)[0] ?? '';
  return decodeURIComponent(withoutFragment.split('?', 1)[0] ?? '');
}

export const docsCheck: Check = {
  name: 'Documentation',
  async run({ root }) {
    const readmeName = (await pathExists(join(root, 'README.md'))) ? 'README.md' : 'README';
    const content = await readTextIfPresent(join(root, readmeName));
    if (content === undefined) {
      return [
        {
          id: 'docs.readme',
          level: 'fail',
          title: 'README could not be inspected',
          detail: 'No README content was available.',
          remediation: 'Add installation, usage, troubleshooting, and limitations documentation.',
        },
      ];
    }

    const findings: Finding[] = [];
    const privatePaths = content.match(privatePathPattern)?.length ?? 0;
    findings.push(
      privatePaths === 0
        ? {
            id: 'docs.private-paths',
            level: 'pass',
            title: 'README contains no personal filesystem paths',
            detail: 'No common home-directory patterns were detected.',
          }
        : {
            id: 'docs.private-paths',
            level: 'fail',
            title: 'README contains personal filesystem paths',
            detail: `${privatePaths} potentially identifying path${privatePaths === 1 ? '' : 's'} detected. Values were not displayed.`,
            remediation: 'Replace personal paths with repository-relative or generic examples.',
          },
    );

    const placeholders = content.match(placeholderPattern)?.length ?? 0;
    findings.push(
      placeholders === 0
        ? {
            id: 'docs.placeholders',
            level: 'pass',
            title: 'README has no obvious placeholders',
            detail: 'Common unfinished template markers were not detected.',
          }
        : {
            id: 'docs.placeholders',
            level: 'warn',
            title: 'README may contain placeholders',
            detail: `${placeholders} common placeholder marker${placeholders === 1 ? '' : 's'} detected.`,
            remediation: 'Replace template text with accurate project-specific documentation.',
          },
    );

    const links = [...content.matchAll(markdownLinkPattern)].map((match) => match[1] ?? '');
    const broken: string[] = [];
    for (const target of links) {
      if (!target || isExternal(target)) continue;
      const clean = stripTarget(target);
      if (!clean) continue;
      const decoded = normalize(clean);
      if (isAbsolute(decoded)) {
        broken.push('<absolute-path>');
        continue;
      }
      const candidate = join(root, dirname(readmeName), decoded);
      if (!(await pathExists(candidate))) broken.push(safeRelativePath(clean));
    }
    findings.push(
      broken.length === 0
        ? {
            id: 'docs.relative-links',
            level: 'pass',
            title: 'README relative links resolve',
            detail: `${links.length} Markdown link${links.length === 1 ? '' : 's'} inspected.`,
          }
        : {
            id: 'docs.relative-links',
            level: 'fail',
            title: 'README contains broken relative links',
            detail: `${broken.length} local link${broken.length === 1 ? '' : 's'} do not resolve.`,
            remediation: 'Correct or remove missing local documentation and image targets.',
          },
    );

    const expectedSections = ['install', 'usage', 'troubleshoot', 'security', 'limit'];
    const lower = content.toLowerCase();
    const missing = expectedSections.filter((section) => !lower.includes(section));
    findings.push(
      missing.length === 0
        ? {
            id: 'docs.sections',
            level: 'pass',
            title: 'README covers operational basics',
            detail: 'Installation, usage, troubleshooting, security, and limitations are addressed.',
          }
        : {
            id: 'docs.sections',
            level: 'warn',
            title: 'README is missing operational guidance',
            detail: `${missing.length} recommended topic${missing.length === 1 ? '' : 's'} could not be identified.`,
            remediation: 'Document installation, usage, troubleshooting, security, and honest limitations.',
          },
    );

    const images = links.filter((link) => ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extname(stripTarget(link)).toLowerCase()));
    findings.push({
      id: 'docs.demo',
      level: images.length > 0 ? 'pass' : 'info',
      title: images.length > 0 ? 'README includes a visual' : 'README has no visual demo',
      detail:
        images.length > 0
          ? `${images.length} image or demo asset${images.length === 1 ? '' : 's'} referenced.`
          : 'A terminal recording or screenshot can make the project easier to evaluate.',
    });

    return findings;
  },
};
