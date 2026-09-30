// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const BASELINE_PATH = join(__dirname, 'time-formatting-goes-through-the-module.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);

const TIME_HOME = 'apps/desktop/src/shared/utils/time/';
const INTL_HOME = 'apps/desktop/src/shared/utils/time/formatIntl.ts';

type Rule = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly isExempt: (path: string) => boolean;
  readonly hint: string;
};

const RULES: ReadonlyArray<Rule> = [
  {
    id: 'own-date-formatting',
    pattern: /\.toLocale(?:Time|Date)String\s*\(|\bIntl\.(?:DateTimeFormat|RelativeTimeFormat)\b/g,
    isExempt: (path) => path === INTL_HOME,
    hint: 'call a formatter from shared/utils/time/ (formatClock, formatDayMonth, formatDate, formatDateTime, formatWeekday), so every date reads the same on every machine',
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

const productSources = (): ReadonlyArray<string> =>
  sourceRoots()
    .flatMap(walk)
    .map(toPath)
    .filter(isTypeScript)
    .filter((path) => !isTestSupport(path))
    .sort((left, right) => left.localeCompare(right));

const countMatches = ({
  text,
  pattern,
}: {
  readonly text: string;
  readonly pattern: RegExp;
}): number => (text.match(pattern) ?? []).length;

const measure = (): Counts => {
  const texts = productSources().map(
    (path) => [path, readFileSync(join(REPO_ROOT, path), 'utf8')] as const,
  );
  return Object.fromEntries(
    RULES.map((rule) => [
      rule.id,
      Object.fromEntries(
        texts
          .filter(([path]) => !rule.isExempt(path))
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

const countOf = ({ id, text }: { readonly id: string; readonly text: string }): number => {
  const rule = RULES.find((candidate) => candidate.id === id);
  return rule === undefined ? -1 : countMatches({ text, pattern: rule.pattern });
};

describe('dates and times are formatted by shared/utils/time', () => {
  it('scans product code in the app and in every package, never an empty sweep', () => {
    const sources = productSources();

    expect(sources.some((path) => path.startsWith('apps/desktop/src/'))).toBe(true);
    expect(sources.some((path) => path.startsWith('packages/core/src/'))).toBe(true);
    expect(sources).toContain(INTL_HOME);
  });

  it('recognises the machine locale formatters and nothing else', () => {
    expect(countOf({ id: 'own-date-formatting', text: 'date.toLocaleTimeString();' })).toBe(1);
    expect(countOf({ id: 'own-date-formatting', text: "date.toLocaleDateString('en-US')" })).toBe(
      1,
    );
    expect(
      countOf({ id: 'own-date-formatting', text: "new Intl.DateTimeFormat('en-US', {})" }),
    ).toBe(1);
    expect(countOf({ id: 'own-date-formatting', text: 'new Intl.RelativeTimeFormat()' })).toBe(1);
    expect(countOf({ id: 'own-date-formatting', text: 'value.toLocaleLowerCase()' })).toBe(0);
    expect(countOf({ id: 'own-date-formatting', text: 'const Intl_ = 1;' })).toBe(0);
  });

  it('keeps the module folder holding the one Intl call site', () => {
    const insideModule = productSources().filter((path) => path.startsWith(TIME_HOME));
    const withIntl = insideModule.filter(
      (path) =>
        countMatches({
          text: readFileSync(join(REPO_ROOT, path), 'utf8'),
          pattern: RULES[0]?.pattern ?? /$^/,
        }) > 0,
    );

    expect(withIntl).toEqual([INTL_HOME]);
  });

  it('adds no date formatting or legacy age import beyond the baseline', () => {
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
        `Date or time formatting grew outside shared/utils/time. docs/file-system.md, ` +
          `Shared utilities, names the module. A cleanup that removes call ` +
          `sites regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });
});
