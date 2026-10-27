// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const STORE_DIR = join(DESKTOP_SRC, 'store');
const HARNESS = join(STORE_DIR, 'storyHarness.ts');
const BASELINE_PATH = join(__dirname, 'static-store-imports.baseline.json');
const UPDATE_MODE = process.env.GOODBOY_UPDATE_BASELINE;
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const STORE_ENTRIES: ReadonlySet<string> = new Set([
  STORE_DIR,
  join(STORE_DIR, 'store'),
  join(STORE_DIR, 'index'),
]);
const STATIC_IMPORT = /^import (?!type\b)([^;'"]*?)\bfrom\s+['"]([^'"]+)['"]/gm;

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

const hasValueBinding = (clause: string): boolean =>
  clause.replace(/\btype\s+\w+(?:\s+as\s+\w+)?/g, '').replace(/[{},\s]/g, '') !== '';

const countStaticStoreImports = ({ file, text }: { file: string; text: string }): number =>
  Array.from(text.matchAll(STATIC_IMPORT)).filter((match) => {
    const specifier = match[2] ?? '';
    if (!specifier.startsWith('.') || !hasValueBinding(match[1] ?? '')) {
      return false;
    }
    return STORE_ENTRIES.has(stripExtension(resolve(dirname(file), specifier)));
  }).length;

const measure = (): Counts =>
  Object.fromEntries(
    walk(DESKTOP_SRC)
      .filter((full) => /\.test\.tsx?$/.test(full) && full !== HARNESS)
      .map(
        (full) =>
          [
            toPath(full),
            countStaticStoreImports({ file: full, text: readFileSync(full, 'utf8') }),
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

describe('static store imports in desktop tests only ever shrink', () => {
  it('counts a value import of the store entry and nothing else', () => {
    const file = join(DESKTOP_SRC, 'features', 'sessions', 'Panel', 'index.test.tsx');
    const count = (text: string): number => countStaticStoreImports({ file, text });

    expect(count("import { useAppStore } from '../../../store';")).toBe(1);
    expect(count("import { useAppStore } from '../../../store/store';")).toBe(1);
    expect(count("import { useAppStore } from '../../../store/index';")).toBe(1);
    expect(count("import {\n  useAppStore,\n  type AppState,\n} from '../../../store';")).toBe(1);
    expect(count("import type { AppState } from '../../../store';")).toBe(0);
    expect(count("import { type AppState } from '../../../store';")).toBe(0);
    expect(count("import { useAppStore } from '../../../store/storyHarness';")).toBe(0);
    expect(count("import { x } from '../../../store/slices/sessions/selectors';")).toBe(0);
    expect(count("import { useAppStore } from 'zustand';")).toBe(0);
  });

  it('finds desktop test files that import the store, never an empty sweep', () => {
    expect(Object.keys(measure()).length).toBeGreaterThan(0);
  });

  it('lets no test file import the store statically beyond its baseline', () => {
    const current = measure();
    if (UPDATE_MODE === '1') {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const grown = Object.entries(current).flatMap(([path, count]) => {
      const allowed = baseline[path] ?? 0;
      return count > allowed
        ? [
            `  - ${path}: ${count} (baseline ${allowed}), load the store with importStore() in beforeAll`,
          ]
        : [];
    });
    expect(
      grown,
      `A static import of the store skips the beforeAll budget and the per-test reset. Use importStore and resetStoryStore from store/storyHarness.ts. A cleanup that converts a file regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
