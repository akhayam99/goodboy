// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const FEATURES_ROOT = join(REPO_ROOT, 'apps', 'desktop', 'src', 'features');
const BASELINE_PATH = join(__dirname, 'hand-indent.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const HAND_INDENT = /(?<![\w-])pl-[579](?![\w.-])/g;

type Counts = Readonly<Record<string, number>>;

const walk = (directory: string): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
};

const toPath = (full: string): string => relative(REPO_ROOT, full).split(sep).join('/');

const isProductComponent = (path: string): boolean =>
  path.endsWith('.tsx') && !/\.test\.tsx$/.test(path);

const countHandIndents = ({ text }: { readonly text: string }): number =>
  (text.match(HAND_INDENT) ?? []).length;

const measure = (): Counts =>
  Object.fromEntries(
    walk(FEATURES_ROOT)
      .map(toPath)
      .filter(isProductComponent)
      .sort((left, right) => left.localeCompare(right))
      .map(
        (path) =>
          [path, countHandIndents({ text: readFileSync(join(REPO_ROOT, path), 'utf8') })] as const,
      )
      .filter(([, count]) => count > 0),
  );

const isCounts = (value: unknown): value is Counts =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((count) => typeof count === 'number');

const readBaseline = (): Counts => {
  if (!existsSync(BASELINE_PATH)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return isCounts(parsed) ? parsed : {};
};

describe('hand-indented disclosure bodies only ever shrink', () => {
  it('counts pl-5, pl-7 and pl-9 and leaves measured or other values alone', () => {
    expect(countHandIndents({ text: "'flex pl-7 pr-2'" })).toBe(1);
    expect(countHandIndents({ text: "'pl-5 x pl-9'" })).toBe(2);
    expect(countHandIndents({ text: "'pl-[calc(8px+14px+8px)]'" })).toBe(0);
    expect(countHandIndents({ text: "'pl-6 sm:pl-70 pl-7.5'" })).toBe(0);
  });

  it('adds no hand indent to any file beyond its baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const grown = Object.entries(current).flatMap(([path, count]) => {
      const allowed = baseline[path] ?? 0;
      return count > allowed ? [`  - ${path}: ${count} (baseline ${allowed})`] : [];
    });
    if (grown.length > 0) {
      throw new Error(
        `Hand indents grew. Use Disclosure from @goodboy/ui, whose body indent is measured from ` +
          `its toggle (DESIGN-SYSTEM.md, Disclosure). A cleanup that removes indents ` +
          `regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });

  it('keeps the settings disclosure bodies and the chat handoff rows off hand indents', () => {
    expect(
      Object.keys(measure()).filter(
        (path) =>
          path.includes('/features/settings/') ||
          path.endsWith('/HandoffBlock/HandoffSectionRow.tsx'),
      ),
    ).toEqual([]);
  });
});
