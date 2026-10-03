// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const BASELINE_PATH = join(__dirname, 'class-assertions.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const CLASS_ASSERTION =
  /\.toHaveClass\(|\.classList\.(?:contains|toString)\(|\bexpect\(\s*[\w$.?!()'"\s[\]-]*?\.(?:className|getAttribute\(\s*['"]class['"]\s*\))\s*\)/g;

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

const countClassAssertions = (text: string): number => (text.match(CLASS_ASSERTION) ?? []).length;

const measure = (): Counts =>
  Object.fromEntries(
    walk(DESKTOP_SRC)
      .filter((full) => /\.test\.tsx?$/.test(full))
      .map((full) => [toPath(full), countClassAssertions(readFileSync(full, 'utf8'))] as const)
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

describe('class assertions in desktop tests only ever shrink', () => {
  it('counts a class assertion on a node, and nothing else', () => {
    expect(countClassAssertions("expect(node).toHaveClass('bg-subtle');")).toBe(1);
    expect(countClassAssertions("expect(node).not.toHaveClass('hidden');")).toBe(1);
    expect(countClassAssertions("expect(node.classList.contains('a')).toBe(true);")).toBe(1);
    expect(countClassAssertions("expect(screen.getByRole('row').className).toContain('x');")).toBe(
      1,
    );
    expect(countClassAssertions("expect(node.getAttribute('class')).toMatch(/x/);")).toBe(1);
    expect(countClassAssertions("expect(node).toHaveAttribute('aria-pressed', 'true');")).toBe(0);
    expect(countClassAssertions("expect(screen.getByRole('row')).toBeTruthy();")).toBe(0);
    expect(countClassAssertions("const className = 'a';")).toBe(0);
  });

  it('finds desktop test files that use the pattern, never an empty sweep', () => {
    expect(Object.keys(measure()).length).toBeGreaterThan(0);
  });

  it('lets no test file assert a class beyond its baseline', () => {
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
            `  - ${path}: ${count} (baseline ${allowed}), assert a role, text, aria attribute or state`,
          ]
        : [];
    });
    if (grown.length > 0) {
      throw new Error(
        `A desktop test asserts a CSS class. A class pins how a node looks, so the test breaks on a ` +
          `restyle that changes no behavior. The class contract lives in packages/ui. ` +
          `docs/testing.md, Rules for every change, says what to assert. A cleanup that removes ` +
          `them regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });
});
