// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const BASELINE_PATH = join(__dirname, 'test-casts.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const TESTING_IMPORT = /from\s*['"]@goodboy\/types\/testing['"]/;
const STRING_LITERAL = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

type Rule = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly hint: string;
};

const RULES: ReadonlyArray<Rule> = [
  {
    id: 'double-cast',
    pattern: /\bas unknown as\b/g,
    hint: 'build the value with a builder from @goodboy/types/testing, or type the fake with satisfies Pick<...>',
  },
  {
    id: 'never-or-any-cast',
    pattern: /\bas (?:never|any)\b/g,
    hint: 'give the value its real type: a builder from @goodboy/types/testing, or a typed stub',
  },
  {
    id: 'domain-cast',
    pattern: /\bas (?:Session|Agent|Project|Workspace|WorkflowRun)\b(?!\[)/g,
    hint: 'call aSession, anAgent, aProject, aWorkspace or aWorkflowRun from @goodboy/types/testing: a cast leaves fields undefined',
  },
];

type Counts = Readonly<Record<string, Readonly<Record<string, number>>>>;

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

const isTypeScript = (path: string): boolean => /\.tsx?$/.test(path) && !path.endsWith('.d.ts');

const isTestSupport = (path: string): boolean =>
  /\.test\.tsx?$/.test(path) ||
  path.endsWith('/storyHarness.ts') ||
  /\/src\/test\//.test(path) ||
  /\/test-helpers\//.test(path) ||
  /\/testing\//.test(path);

const sourceRoots = (): ReadonlyArray<string> => [
  join(REPO_ROOT, 'apps', 'desktop', 'src'),
  ...readdirSync(join(REPO_ROOT, 'packages')).map((name) =>
    join(REPO_ROOT, 'packages', name, 'src'),
  ),
];

const allSources = (): ReadonlyArray<string> =>
  sourceRoots()
    .flatMap(walk)
    .map(toPath)
    .filter(isTypeScript)
    .sort((left, right) => left.localeCompare(right));

const countMatches = ({
  text,
  pattern,
}: {
  readonly text: string;
  readonly pattern: RegExp;
}): number =>
  text
    .split('\n')
    .reduce(
      (total, line) => total + (line.replace(STRING_LITERAL, '""').match(pattern) ?? []).length,
      0,
    );

const measure = (): Counts => {
  const tests = allSources().filter(isTestSupport);
  const texts = tests.map((path) => [path, readFileSync(join(REPO_ROOT, path), 'utf8')] as const);
  return Object.fromEntries(
    RULES.map((rule) => [
      rule.id,
      Object.fromEntries(
        texts
          .map(([path, text]) => [path, countMatches({ text, pattern: rule.pattern })] as const)
          .filter(([, count]) => count > 0),
      ),
    ]),
  );
};

const isCounts = (value: unknown): value is Counts =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every(
    (files) =>
      typeof files === 'object' &&
      files !== null &&
      Object.values(files).every((count) => typeof count === 'number'),
  );

const readBaseline = (): Counts => {
  if (!existsSync(BASELINE_PATH)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return isCounts(parsed) ? parsed : {};
};

describe('casts in tests only ever shrink', () => {
  it('finds test files in every scanned tree, never an empty sweep', () => {
    const tests = allSources().filter(isTestSupport);

    expect(tests.some((path) => path.startsWith('apps/desktop/src/'))).toBe(true);
    expect(tests.some((path) => path.startsWith('packages/core/src/'))).toBe(true);
    expect(tests.some((path) => path.startsWith('packages/db/src/'))).toBe(true);
  });

  it('counts a double cast, a never cast and a partial domain cast, and nothing else', () => {
    const count = (id: string, text: string): number => {
      const rule = RULES.find((candidate) => candidate.id === id);
      return rule === undefined ? -1 : countMatches({ text, pattern: rule.pattern });
    };

    expect(count('double-cast', 'const a = { id } as unknown as Session;')).toBe(1);
    expect(count('double-cast', "const label = 'as unknown as Session';")).toBe(0);
    expect(count('never-or-any-cast', 'run(store as never, other as never);')).toBe(2);
    expect(count('never-or-any-cast', 'const neverSeen = 1;')).toBe(0);
    expect(count('domain-cast', 'const a = { id } as Session;')).toBe(1);
    expect(count('domain-cast', 'const a = { id } as unknown as Agent;')).toBe(1);
    expect(count('domain-cast', "const id = 'x' as Session['id'];")).toBe(0);
    expect(count('domain-cast', 'const a = aSession({ id });')).toBe(0);
    expect(count('domain-cast', 'const a = x as SessionId;')).toBe(0);
  });

  it('adds no cast to any test file beyond its baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const grown = RULES.flatMap((rule) =>
      Object.entries(current[rule.id] ?? {}).flatMap(([path, count]) => {
        const allowed = baseline[rule.id]?.[path] ?? 0;
        return count > allowed
          ? [`  - ${rule.id} ${path}: ${count} (baseline ${allowed}), ${rule.hint}`]
          : [];
      }),
    );
    if (grown.length > 0) {
      throw new Error(
        `Casts in tests grew. docs/testing.md, Test data, says how to build the value. A ` +
          `cleanup that removes casts regenerates the baseline with ` +
          `GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });

  it('keeps the test data module out of product code', () => {
    const importers = allSources()
      .filter((path) => !isTestSupport(path))
      .filter((path) => TESTING_IMPORT.test(readFileSync(join(REPO_ROOT, path), 'utf8')));

    expect(importers).toEqual([]);
  });
});
