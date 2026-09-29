// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REVIEW_KIND } from '../actions/kinds/review';
import { REVIEW_COMMENT_KIND } from '../actions/kinds/reviewComment';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD_FILE_NAME = 'resolveQueueCopyGuard.test.ts';

const FORBIDDEN_STRINGS: ReadonlyArray<string> = [
  'Needs decision',
  'Needs answer',
  'Accepted, not yet delivered',
  'Confirm group',
  'Acceptance cleared',
  'Accept group',
];

const FORBIDDEN_WORDS: ReadonlyArray<string> = ['deliver', 'manifest', 'expected head', 'receipt'];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const collectSourceFiles = ({ root }: { readonly root: string }): ReadonlyArray<string> => {
  const files: Array<string> = [];
  const walk = ({ dir }: { readonly dir: string }): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk({ dir: full });
        continue;
      }
      if (entry === GUARD_FILE_NAME) {
        continue;
      }
      const dot = entry.lastIndexOf('.');
      const ext = dot === -1 ? '' : entry.slice(dot);
      if (SOURCE_EXTENSIONS.has(ext)) {
        files.push(full);
      }
    }
  };
  walk({ dir: root });
  return files;
};

const LITERAL = /'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`/g;

const prose = ({ contents }: { readonly contents: string }): ReadonlyArray<string> => {
  const body = contents
    .split('\n')
    .filter(
      (line) => !/^\s*(?:import|export)\b.*\bfrom\b/.test(line) && !/^\s*import\s*\(/.test(line),
    )
    .join('\n');
  return [...body.matchAll(LITERAL)].flatMap((match) => {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    return value.trim() === '' || !/\s/.test(value.trim()) ? [] : [value];
  });
};

describe('resolve queue copy guard', () => {
  const roots = [HERE, join(HERE, '..', 'review')];

  it('never reintroduces the legacy wizard copy in the resolve or review feature folders', () => {
    const offenders: Array<string> = [];
    for (const root of roots) {
      for (const file of collectSourceFiles({ root })) {
        const contents = readFileSync(file, 'utf8');
        for (const forbidden of FORBIDDEN_STRINGS) {
          if (contents.includes(forbidden)) {
            offenders.push(`${file}: "${forbidden}"`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('reads the sentences it is meant to guard', () => {
    const sentences = prose({
      contents: readFileSync(join(HERE, 'resolvePublishCopy.ts'), 'utf8'),
    });
    expect(sentences).toContain('Worktree has uncommitted changes');
    expect(sentences).toContain('The branch carries a commit you did not approve');
  });

  it('keeps the engineering vocabulary out of every sentence a user reads', () => {
    const offenders: Array<string> = [];
    for (const root of roots) {
      for (const file of collectSourceFiles({ root })) {
        if (file.includes('.test.')) {
          continue;
        }
        for (const sentence of prose({ contents: readFileSync(file, 'utf8') })) {
          for (const word of FORBIDDEN_WORDS) {
            if (sentence.toLowerCase().includes(word)) {
              offenders.push(`${file}: "${sentence}"`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps no copy nobody reads in the Review copy files', () => {
    const copyFiles = [
      'resolveQueueCopy.ts',
      'resolvePublishCopy.ts',
      'reviewFlowCopy.ts',
      'reviewPushCopy.ts',
      'resolveItemCopy.ts',
    ];
    const desktopSrc = join(HERE, '..', '..');
    const readers = collectSourceFiles({ root: desktopSrc }).filter(
      (file) => !file.includes('.test.') && !copyFiles.some((copy) => file.endsWith(copy)),
    );
    const sources = readers.map((file) => readFileSync(file, 'utf8'));
    const isRead = (pattern: RegExp): boolean => sources.some((source) => pattern.test(source));
    const unused = copyFiles.flatMap((copy) => {
      const contents = readFileSync(join(HERE, copy), 'utf8');
      const names = [...contents.matchAll(/^export const (\w+)/gm)].map((match) => match[1] ?? '');
      const labels = [
        ...contents.matchAll(/^export const (\w+) = \{\n([\s\S]*?)\n\} as const;/gm),
      ].flatMap((match) =>
        [...(match[2] ?? '').matchAll(/^ {2}(\w+):/gm)].map(
          (key) => `${match[1] ?? ''}.${key[1] ?? ''}`,
        ),
      );
      return [
        ...names.filter((name) => !isRead(new RegExp(`\\b${name}\\b`))),
        ...labels.filter((label) => !isRead(new RegExp(`\\b${label.replace('.', '\\.')}\\b`))),
      ].map((name) => `${copy}: ${name}`);
    });
    expect(unused).toEqual([]);
  });

  it('never names a Review button Resolve', () => {
    const labels = [...REVIEW_KIND.actions, ...REVIEW_COMMENT_KIND.actions].map((action) =>
      typeof action.label === 'string' ? action.label : action.id,
    );
    expect(labels.filter((label) => label === 'Resolve' || /^Resolve \d/.test(label))).toEqual([]);
  });
});
