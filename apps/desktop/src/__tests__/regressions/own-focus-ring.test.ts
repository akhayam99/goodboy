// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const BASELINE_PATH = join(__dirname, 'own-focus-ring.baseline.json');
const isUpdatingBaseline = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const FOCUS_RING_SOURCE = 'packages/ui/src/focusRing.ts';
const OWN_RING = /focus-visible:ring-2/g;

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

const isProductSource = (path: string): boolean =>
  /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && path !== FOCUS_RING_SOURCE;

const countRings = ({ text }: { readonly text: string }): number =>
  (text.match(OWN_RING) ?? []).length;

const measure = (): Counts =>
  Object.fromEntries(
    [join(REPO_ROOT, 'apps', 'desktop', 'src'), join(REPO_ROOT, 'packages', 'ui', 'src')]
      .flatMap(walk)
      .map(toPath)
      .filter(isProductSource)
      .sort((left, right) => left.localeCompare(right))
      .map(
        (path) =>
          [path, countRings({ text: readFileSync(join(REPO_ROOT, path), 'utf8') })] as const,
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

describe('a control takes its focus ring from FOCUS_RING', () => {
  it('counts a hand-written ring and leaves the constant alone', () => {
    expect(
      countRings({
        text: "'rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'",
      }),
    ).toBe(1);
    expect(countRings({ text: "cn('rounded-md px-2', FOCUS_RING)" })).toBe(0);
  });

  it('keeps the three tokens of the ring in the one shared constant', () => {
    const source = readFileSync(join(REPO_ROOT, FOCUS_RING_SOURCE), 'utf8');

    expect(source).toContain('focus-visible:outline-none');
    expect(source).toContain('focus-visible:ring-2');
    expect(source).toContain('focus-visible:ring-focus-ring');
  });

  it('adds no hand-written ring to any file beyond its baseline', () => {
    const current = measure();
    if (isUpdatingBaseline) {
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
        `A focus ring was written by hand. Compose FOCUS_RING from @goodboy/ui, with ` +
          `ring-inset beside it for a clipped control (docs/styling.md, Focus rings). A cleanup ` +
          `that removes rings regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n\n` +
          `${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });
});
