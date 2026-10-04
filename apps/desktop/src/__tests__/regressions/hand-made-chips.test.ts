// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const BASELINE_PATH = join(__dirname, 'hand-made-chips.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const CHIP_SOURCE = 'packages/ui/src/components/Chip.tsx';
const HAND_MADE_PILL = /rounded-full\b[^'"`]*(?<![\w-])border\b|rounded-(?:sm|md) px-1\.5/g;

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
  path.endsWith('.tsx') && !/\.test\.tsx$/.test(path) && path !== CHIP_SOURCE;

const countPills = ({ text }: { readonly text: string }): number =>
  text.split('\n').reduce((total, line) => total + (line.match(HAND_MADE_PILL) ?? []).length, 0);

const measure = (): Counts =>
  Object.fromEntries(
    [join(REPO_ROOT, 'apps', 'desktop', 'src'), join(REPO_ROOT, 'packages', 'ui', 'src')]
      .flatMap(walk)
      .map(toPath)
      .filter(isProductComponent)
      .sort((left, right) => left.localeCompare(right))
      .map(
        (path) =>
          [path, countPills({ text: readFileSync(join(REPO_ROOT, path), 'utf8') })] as const,
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

describe('hand-made status pills only ever shrink', () => {
  it('counts a hand-rolled pill and leaves a plain rounded box alone', () => {
    expect(countPills({ text: "'inline-flex rounded-full border px-2 text-meta'" })).toBe(1);
    expect(countPills({ text: "'rounded-md px-1.5 py-0.5 text-chip ring-1'" })).toBe(1);
    expect(countPills({ text: "'rounded-sm px-1.5 text-chip bg-muted'" })).toBe(1);
    expect(countPills({ text: "'rounded-md bg-subtle px-3 py-2'" })).toBe(0);
    expect(countPills({ text: "'size-2 rounded-full bg-border'" })).toBe(0);
  });

  it('keeps the activity chips on the app Chip', () => {
    const current = measure();

    expect(
      Object.keys(current).filter(
        (path) =>
          path.endsWith('/TimelinePane/TimelineRunChip.tsx') ||
          path.endsWith('/AgentKindChip/index.tsx'),
      ),
    ).toEqual([]);
  });

  it('adds no hand-made pill to any file beyond its baseline', () => {
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
        `Hand-made pills grew. Use Chip from @goodboy/ui (DESIGN-SYSTEM.md, Chips). A cleanup ` +
          `that removes pills regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n\n` +
          `${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });
});
