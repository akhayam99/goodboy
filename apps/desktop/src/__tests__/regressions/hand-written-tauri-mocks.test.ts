// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const HARNESS = join(DESKTOP_SRC, 'store', 'storyHarness.ts');
const UPDATE_MODE = process.env.GOODBOY_UPDATE_BASELINE;
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const LOOKAHEAD = 200;

const MOCK_OPEN = String.raw`\bvi\.(?:mock|doMock)\(\s*['"]`;
const FACTORY_OPEN = String.raw`['"]\s*,\s*(?:async\s*)?\(`;
const TAURI_CORE_FACTORY = new RegExp(`${MOCK_OPEN}@tauri-apps/api/core${FACTORY_OPEN}`, 'g');
const DB_FACTORY = new RegExp(`${MOCK_OPEN}@goodboy/db${FACTORY_OPEN}`, 'g');

type Counts = Readonly<Record<string, number>>;
type Counter = {
  readonly name: string;
  readonly pattern: RegExp;
  readonly baselinePath: string;
  readonly fix: string;
};

const COUNTERS: ReadonlyArray<Counter> = [
  {
    name: 'a hand-written @tauri-apps/api/core factory',
    pattern: TAURI_CORE_FACTORY,
    baselinePath: join(__dirname, 'hand-written-tauri-mocks.baseline.json'),
    fix: 'tauriCoreModuleMock() from store/storyHarness.ts and stubStoryInvoke for the commands the test needs',
  },
  {
    name: 'an inline @goodboy/db factory',
    pattern: DB_FACTORY,
    baselinePath: join(__dirname, 'hand-written-db-mocks.baseline.json'),
    fix: 'dbModuleMock({ ...your stubs }) from store/storyHarness.ts',
  },
];

const walk = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const toPath = (full: string): string => relative(REPO_ROOT, full).split(sep).join('/');

const countHandWritten = ({ text, pattern }: { text: string; pattern: RegExp }): number =>
  Array.from(text.matchAll(pattern)).filter((match) => {
    const start = (match.index ?? 0) + match[0].length;
    return !text.slice(start, start + LOOKAHEAD).includes('storyHarness');
  }).length;

const measure = (pattern: RegExp): Counts =>
  Object.fromEntries(
    walk(DESKTOP_SRC)
      .filter((full) => /\.test\.tsx?$/.test(full) && full !== HARNESS)
      .map(
        (full) =>
          [toPath(full), countHandWritten({ text: readFileSync(full, 'utf8'), pattern })] as const,
      )
      .filter(([, count]) => count > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

const isCounts = (value: unknown): value is Counts =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((count) => typeof count === 'number');

const readBaseline = (path: string): Counts => {
  if (!existsSync(path)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return isCounts(parsed) ? parsed : {};
};

describe('hand-written Tauri and db mocks only ever shrink', () => {
  it('counts a factory written in the test and skips one that comes from the harness', () => {
    const tauri = (text: string): number => countHandWritten({ text, pattern: TAURI_CORE_FACTORY });
    const db = (text: string): number => countHandWritten({ text, pattern: DB_FACTORY });

    expect(tauri("vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));")).toBe(1);
    expect(tauri("vi.doMock('@tauri-apps/api/core', async () => ({ invoke: vi.fn() }));")).toBe(1);
    expect(tauri("vi.mock('@tauri-apps/api/core', () => {\n  return { x: 1 };\n});")).toBe(1);
    expect(
      tauri(
        "vi.mock('@tauri-apps/api/core', async () => (await import('../../store/storyHarness')).tauriCoreModuleMock());",
      ),
    ).toBe(0);
    expect(tauri("vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));")).toBe(0);
    expect(db("vi.mock('@goodboy/db', () => ({ listSessions: vi.fn() }));")).toBe(1);
    expect(
      db(
        "vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());",
      ),
    ).toBe(0);
    expect(db("vi.mock('@goodboy/db/migrations', () => ({}));")).toBe(0);
  });

  it.each(COUNTERS)('finds test files with $name, never an empty sweep', ({ pattern }) => {
    expect(Object.keys(measure(pattern)).length).toBeGreaterThan(0);
  });

  it.each(COUNTERS)(
    'lets no test file hold more of $name than its baseline',
    ({ pattern, baselinePath, fix }) => {
      const current = measure(pattern);
      if (UPDATE_MODE === '1') {
        writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
        return;
      }
      const baseline = readBaseline(baselinePath);
      const grown = Object.entries(current).flatMap(([path, count]) => {
        const allowed = baseline[path] ?? 0;
        return count > allowed ? [`  - ${path}: ${count} (baseline ${allowed})`] : [];
      });
      expect(
        grown,
        `A hand-written mock forgets a command and the unexpected-call guard never sees it. Use ${fix}.\n\n${grown.join('\n')}`,
      ).toEqual([]);
    },
  );
});
