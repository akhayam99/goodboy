// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const BASELINE_FILE = 'duplicate-helper.baseline.json';
const MIN_FILES = 3;

const HOMES: Readonly<Record<string, string>> = {
  isRecord: '@goodboy/types/helpers',
  isProviderId: '@goodboy/types/helpers',
  isoNow: '@goodboy/types/helpers',
  nowIso: '@goodboy/types/helpers',
  plural: 'shared/utils/pluralize.ts',
  prefersReducedMotion: 'packages/ui/src/canAnimate.ts',
};

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'target',
  'gen',
  '__tests__',
  'testing',
  'MockScene',
]);

const PRIVATE_HELPER =
  /^(?:const (\w+)(?::[^=\n]+)? = (?:async )?\(|(?:async )?function (\w+)\()/gm;

type TextParams = {
  readonly text: string;
};

type WalkParams = {
  readonly directory: string;
};

const walk = ({ directory }: WalkParams): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk({ directory: full }) : [full];
  });
};

const roots = (): ReadonlyArray<string> => [
  join(REPO_ROOT, 'apps', 'desktop', 'src'),
  ...readdirSync(join(REPO_ROOT, 'packages')).map((name) =>
    join(REPO_ROOT, 'packages', name, 'src'),
  ),
];

const isProduct = (full: string): boolean =>
  /\.tsx?$/.test(full) && !/\.(test|d)\.tsx?$/.test(full) && !full.endsWith('storyHarness.ts');

const privateHelperNames = ({ text }: TextParams): ReadonlyArray<string> => [
  ...new Set(
    [...text.matchAll(PRIVATE_HELPER)].flatMap((match) => {
      const name = match[1] ?? match[2];
      return name === undefined ? [] : [name];
    }),
  ),
];

const measure = (): FileCounts => {
  const filesByName = new Map<string, number>();
  for (const full of roots()
    .flatMap((directory) => walk({ directory }))
    .filter(isProduct)) {
    for (const name of privateHelperNames({ text: readFileSync(full, 'utf8') })) {
      filesByName.set(name, (filesByName.get(name) ?? 0) + 1);
    }
  }
  return Object.fromEntries(
    [...filesByName.entries()]
      .filter(([, files]) => files >= MIN_FILES)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
};

const hintFor = ({ name }: { readonly name: string }): string =>
  HOMES[name] === undefined
    ? 'move one copy to a shared home and import it from there'
    : `use the one in ${HOMES[name]}`;

describe('a helper is written once, never copied into three files', () => {
  it('finds a private function by name and ignores an exported one', () => {
    const text = [
      'const isRecord = (value: unknown): boolean => value !== null;',
      'export const isExported = (value: unknown): boolean => value !== null;',
      'function plural(count: number): string {',
      '  return String(count);',
      '}',
      'const LIMIT = 3;',
    ].join('\n');
    expect(privateHelperNames({ text })).toEqual(['isRecord', 'plural']);
  });

  it('keeps the shared guards out of every file', () => {
    const current = measure();
    expect(current.isRecord).toBeUndefined();
    expect(current.isProviderId).toBeUndefined();
    expect(current.isoNow).toBeUndefined();
  });

  it('lets no name spread to more files than its baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const baseline = readBaseline({ file: BASELINE_FILE });
    const grown = grownEntries({ current, baseline }).map((line) => {
      const name = line.trim().replace(/^- /, '').split(':')[0] ?? '';
      return `${line}, ${hintFor({ name })}`;
    });
    expect(
      grown,
      `A top-level helper that three files each write privately is one helper in one place. A fix lands in one copy otherwise and the others drift. docs/file-system.md says where shared code goes. The baseline counts files per name and only falls.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
