// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@goodboy/types';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const BASELINE_PATH = join(__dirname, 'provider-id-comparisons.baseline.json');
const isUpdatingBaseline = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'target',
  'gen',
  '__tests__',
  'testing',
  'MockScene',
]);

const ID_ALTERNATION = PROVIDER_IDS.join('|');
const ID_COMPARISON = new RegExp(
  `[!=]==\\s*'(?:${ID_ALTERNATION})'|'(?:${ID_ALTERNATION})'\\s*[!=]==`,
  'g',
);

type Counts = Readonly<Record<string, number>>;

const walk = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const toPath = (full: string): string => relative(REPO_ROOT, full).split(sep).join('/');

const countComparisons = (text: string): number => (text.match(ID_COMPARISON) ?? []).length;

const isSource = (full: string): boolean =>
  /\.tsx?$/.test(full) &&
  !/\.(test|d)\.tsx?$/.test(full) &&
  !full.endsWith('storyHarness.ts') &&
  !full.includes('/storyHarness/');

const roots = (): ReadonlyArray<string> =>
  [
    DESKTOP_SRC,
    ...readdirSync(join(REPO_ROOT, 'packages')).map((name) =>
      join(REPO_ROOT, 'packages', name, 'src'),
    ),
  ].filter((root) => existsSync(root));

const measure = (): Counts =>
  Object.fromEntries(
    roots()
      .flatMap(walk)
      .filter(isSource)
      .map((full) => [toPath(full), countComparisons(readFileSync(full, 'utf8'))] as const)
      .filter(([, count]) => count > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
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

describe('comparisons against a provider id only ever shrink', () => {
  it('counts a strict comparison with a provider id, in either order, and nothing else', () => {
    expect(countComparisons("if (provider === 'cursor') {")).toBe(1);
    expect(countComparisons("if (provider !== 'codex') {")).toBe(1);
    expect(countComparisons("if ('gemini' === provider) {")).toBe(1);
    expect(countComparisons("provider === 'cursor' || provider === 'codex'")).toBe(2);
    expect(countComparisons("const id: ProviderId = 'cursor';")).toBe(0);
    expect(countComparisons("kind === 'cursor-auto'")).toBe(0);
    expect(countComparisons("label === 'claude'")).toBe(0);
  });

  it('finds source files that still branch on a provider id, never an empty sweep', () => {
    expect(Object.keys(measure()).length).toBeGreaterThan(0);
  });

  it('lets no file branch on a provider id beyond its baseline', () => {
    const current = measure();
    if (isUpdatingBaseline) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const grown = Object.entries(current).flatMap(([path, count]) => {
      const allowed = baseline[path] ?? 0;
      return count > allowed
        ? [`  - ${path}: ${count} (baseline ${allowed}), add a flag to PROVIDER_FLAGS and read it`]
        : [];
    });
    expect(
      grown,
      `What a provider can do is a row of packages/core/src/providers/providerFlags.ts, read by the code that branches on it. docs/recipes/add-a-provider.md says how to add a flag and where the provider table lives. A cleanup that removes comparisons regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
