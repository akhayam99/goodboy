// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const DESKTOP_ROOT = join(DESKTOP_SRC, '..');
const REPO_ROOT = join(DESKTOP_ROOT, '..', '..');
const STORE_DIR = join(DESKTOP_SRC, 'store');
const BASELINE_PATH = join(__dirname, 'store-mocks.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const STORE_ENTRIES: ReadonlySet<string> = new Set([
  STORE_DIR,
  join(STORE_DIR, 'store'),
  join(STORE_DIR, 'index'),
]);
const SLICES_DIR = join(STORE_DIR, 'slices');
const MOCK_CALL = /\bvi\.(?:mock|doMock)\(\s*(?:await\s+)?(?:import\(\s*)?(['"`])([^'"`]+)\1/g;

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

const stripExtension = (path: string): string => path.replace(/\.(?:tsx?|jsx?)$/, '');

const targetsStore = ({ file, specifier }: { file: string; specifier: string }): boolean => {
  if (!specifier.startsWith('.')) {
    return false;
  }
  const resolved = stripExtension(resolve(dirname(file), specifier));
  return STORE_ENTRIES.has(resolved) || resolved.startsWith(`${SLICES_DIR}${sep}`);
};

const countStoreMocks = ({ file, text }: { file: string; text: string }): number =>
  Array.from(text.matchAll(MOCK_CALL)).filter((match) =>
    targetsStore({ file, specifier: match[2] ?? '' }),
  ).length;

const measure = (): Counts =>
  Object.fromEntries(
    walk(DESKTOP_SRC)
      .filter((full) => /\.tsx?$/.test(full) && !full.endsWith('.d.ts'))
      .map(
        (full) =>
          [
            toPath(full),
            countStoreMocks({ file: full, text: readFileSync(full, 'utf8') }),
          ] as const,
      )
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

const call = (name: 'mock' | 'doMock', target: string): string =>
  `vi.${name}('${target}', () => ({}));`;

describe('store mocks in desktop tests only ever shrink', () => {
  it('counts a mock of the store, its entry points and a slice module, and nothing else', () => {
    const file = join(DESKTOP_SRC, 'features', 'sessions', 'Panel', 'index.test.tsx');
    const count = (text: string): number => countStoreMocks({ file, text });

    expect(count(call('mock', '../../../store'))).toBe(1);
    expect(count(call('mock', '../../../store/store'))).toBe(1);
    expect(count(call('mock', '../../../store/index'))).toBe(1);
    expect(count(call('doMock', '../../../store/index.ts'))).toBe(1);
    expect(count(call('mock', '../../../store/slices/worktrees/useSessionRepo'))).toBe(1);
    expect(count(`${call('mock', '../../../store')}\n${call('doMock', '../../../store')}`)).toBe(2);
    expect(count(call('mock', '../../../store').replace('(', '(\n  ').replace(',', ',\n  '))).toBe(
      1,
    );
    expect(
      count(call('mock', '../../../store').replace("('", "(import('").replace("',", "'),")),
    ).toBe(1);
    expect(count(call('mock', '../../../features/onboarding/onboarding-store'))).toBe(0);
    expect(count(call('mock', '../../../store/sessionEviction'))).toBe(0);
    expect(count(call('mock', '../../../shared/lib/db'))).toBe(0);
    expect(count(call('mock', '@goodboy/db'))).toBe(0);
    expect(count(call('mock', 'zustand'))).toBe(0);
    expect(count("const label = 'store';")).toBe(0);
  });

  it('finds desktop test files that mock the store, never an empty sweep', () => {
    expect(Object.keys(measure()).length).toBeGreaterThan(0);
  });

  it('lets no test file mock the store more than its baseline allows', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const grown = Object.entries(current).flatMap(([path, count]) => {
      const allowed = baseline[path] ?? 0;
      return count > allowed
        ? [
            `  - ${path}: ${count} (baseline ${allowed}), run the real store through storyHarness (importStore, resetStoryStore, stubStoryInvoke)`,
          ]
        : [];
    });
    if (grown.length > 0) {
      throw new Error(
        `A test mocks the store. docs/testing.md, Rules for every change, says what to use instead. ` +
          `A cleanup that converts a file regenerates the baseline on the integration branch ` +
          `with GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });
});
