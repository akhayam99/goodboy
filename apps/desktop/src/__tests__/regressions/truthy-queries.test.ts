// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const BASELINE_PATH = join(__dirname, 'truthy-queries.baseline.json');
const DEFINED_BASELINE_PATH = join(__dirname, 'truthy-queries.defined.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const TRUTHY_QUERY =
  /\bexpect\(\s*(?:(?:[\w$.]+|within\([^()]*(?:\([^()]*\)[^()]*)*\))\s*\.\s*)?(?:getBy|getAllBy)\w*\([^;]*?\)\s*,?\s*\)\s*\.toBeTruthy\(\)/g;

const DEFINED_QUERY = new RegExp(
  TRUTHY_QUERY.source.replace(
    '\\.toBeTruthy\\(\\)',
    '\\.(?:toBeDefined\\(\\)|not\\.toBeNull\\(\\)|not\\.toBeUndefined\\(\\))',
  ),
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

const countTruthyQueries = (text: string): number => (text.match(TRUTHY_QUERY) ?? []).length;

const countDefinedQueries = (text: string): number => (text.match(DEFINED_QUERY) ?? []).length;

const PACKAGE_SOURCES: ReadonlyArray<string> = readdirSync(join(REPO_ROOT, 'packages')).map(
  (name) => join(REPO_ROOT, 'packages', name, 'src'),
);

type MeasureParams = {
  readonly roots: ReadonlyArray<string>;
  readonly count: (text: string) => number;
};

const measureRoots = ({ roots, count }: MeasureParams): Counts =>
  Object.fromEntries(
    roots
      .filter((root) => existsSync(root))
      .flatMap(walk)
      .filter((full) => /\.test\.tsx?$/.test(full))
      .map((full) => [toPath(full), count(readFileSync(full, 'utf8'))] as const)
      .filter(([, found]) => found > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

const measureDefined = (): Counts =>
  measureRoots({ roots: [DESKTOP_SRC, ...PACKAGE_SOURCES], count: countDefinedQueries });

const measure = (): Counts =>
  Object.fromEntries(
    walk(DESKTOP_SRC)
      .filter((full) => /\.test\.tsx?$/.test(full))
      .map((full) => [toPath(full), countTruthyQueries(readFileSync(full, 'utf8'))] as const)
      .filter(([, count]) => count > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

const isCounts = (value: unknown): value is Counts =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((count) => typeof count === 'number');

const readBaselineFile = ({ path }: { readonly path: string }): Counts => {
  if (!existsSync(path)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return isCounts(parsed) ? parsed : {};
};

const readBaseline = (): Counts => readBaselineFile({ path: BASELINE_PATH });

describe('empty truthy checks on queries only ever shrink', () => {
  it('counts a getBy query asserted truthy, and nothing else', () => {
    expect(countTruthyQueries("expect(screen.getByText('Save')).toBeTruthy();")).toBe(1);
    expect(countTruthyQueries("expect(getByRole('button')).toBeTruthy();")).toBe(1);
    expect(countTruthyQueries("expect(screen.getAllByRole('row')).toBeTruthy();")).toBe(1);
    expect(countTruthyQueries("expect(within(row).getByText('Open')).toBeTruthy();")).toBe(1);
    expect(
      countTruthyQueries(
        "expect(\n  screen.getByRole('button', { name: 'Save' }),\n).toBeTruthy();",
      ),
    ).toBe(1);
    expect(
      countTruthyQueries(
        "expect(screen.getByText('A')).toBeTruthy(); expect(getByText('B')).toBeTruthy();",
      ),
    ).toBe(2);
    expect(countTruthyQueries("expect(screen.queryByText('Save')).toBeTruthy();")).toBe(0);
    expect(countTruthyQueries("expect(screen.queryByText('Save')).toBeNull();")).toBe(0);
    expect(countTruthyQueries('expect(result.current.ready).toBeTruthy();')).toBe(0);
    expect(countTruthyQueries("screen.getByText('Save');")).toBe(0);
  });

  it('finds desktop test files that use the pattern, never an empty sweep', () => {
    expect(Object.keys(measure()).length).toBeGreaterThan(0);
  });

  it('lets no test file assert a getBy query truthy beyond its baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const grown = Object.entries(current).flatMap(([path, count]) => {
      const allowed = baseline[path] ?? 0;
      return count > allowed
        ? [`  - ${path}: ${count} (baseline ${allowed}), call the getBy query on its own`]
        : [];
    });
    if (grown.length > 0) {
      throw new Error(
        `A test asserts a getBy query truthy. The query throws when the node is missing, so the ` +
          `assertion checks nothing. docs/testing.md, Content and rules, says what to write. A ` +
          `cleanup that removes them regenerates the baseline with ` +
          `GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });
});

describe('a defined or non-null check on a query only ever shrinks', () => {
  it('counts a getBy query asserted defined or non-null, and nothing else', () => {
    const defined = ['.toBe', 'Defined()'].join('');
    const notNull = ['.not', '.toBe', 'Null()'].join('');
    expect(countDefinedQueries(`expect(screen.getByText('Save'))${defined};`)).toBe(1);
    expect(countDefinedQueries(`expect(within(row).getByRole('button'))${notNull};`)).toBe(1);
    expect(countDefinedQueries(`expect(screen.getAllByRole('row'))${defined};`)).toBe(1);
    expect(countDefinedQueries(`expect(screen.queryByText('Save'))${defined};`)).toBe(0);
    expect(countDefinedQueries(`expect(result.current.ready)${defined};`)).toBe(0);
  });

  it('lets no test file assert a getBy query defined beyond its baseline', () => {
    const current = measureDefined();
    if (IS_UPDATING) {
      writeFileSync(DEFINED_BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    const baseline = readBaselineFile({ path: DEFINED_BASELINE_PATH });
    const grown = Object.entries(current).flatMap(([path, count]) => {
      const allowed = baseline[path] ?? 0;
      return count > allowed
        ? [`  - ${path}: ${count} (baseline ${allowed}), call the getBy query on its own`]
        : [];
    });
    expect(
      grown,
      `The query throws when the node is missing, so a defined check on it checks nothing. docs/testing.md, Content and rules, says what to write.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
