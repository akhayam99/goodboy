// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const BASELINE_PATH = join(__dirname, 'escape-and-keys-use-the-stack.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);

const STACK_HOME = 'packages/ui/src/escape.ts';
const REGISTRY_HOME = 'apps/desktop/src/shared/keyboard/dispatcher.ts';
const REGISTRY_ENTRIES = 'apps/desktop/src/shared/keyboard/registry.ts';

type Rule = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly exempt: ReadonlySet<string>;
  readonly hint: string;
};

const RULES: ReadonlyArray<Rule> = [
  {
    id: 'escape-literal',
    pattern: /['"]Escape['"]/g,
    exempt: new Set([STACK_HOME, REGISTRY_ENTRIES]),
    hint: 'register a layer with useEscapeLayer or registerEscapeLayer from @goodboy/ui, so Esc closes the topmost layer only',
  },
  {
    id: 'window-key-listener',
    pattern: /\b(?:window|document)\.addEventListener\(\s*['"]keydown['"]/g,
    exempt: new Set([STACK_HOME, REGISTRY_HOME]),
    hint: 'add an entry to shared/keyboard/registry.ts and bind it with useShortcut, or use an escape layer for Esc',
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
          .filter(([path]) => !rule.exempt.has(path))
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

describe('escape and window keys go through the stack and the registry', () => {
  it('scans product code in the app and in every package, never an empty sweep', () => {
    const sources = productSources();

    expect(sources.some((path) => path.startsWith('apps/desktop/src/'))).toBe(true);
    expect(sources.some((path) => path.startsWith('packages/ui/src/'))).toBe(true);
    expect(sources).toContain(STACK_HOME);
    expect(sources).toContain(REGISTRY_HOME);
  });

  it('recognises an Escape literal and a window keydown listener, and nothing else', () => {
    expect(countOf({ id: 'escape-literal', text: "if (event.key === 'Escape') {" })).toBe(1);
    expect(countOf({ id: 'escape-literal', text: 'if (event.key === "Escape") {' })).toBe(1);
    expect(countOf({ id: 'escape-literal', text: "const code = 'Escapes';" })).toBe(0);
    expect(countOf({ id: 'escape-literal', text: "shortcut('Enter')" })).toBe(0);
    expect(
      countOf({ id: 'window-key-listener', text: "window.addEventListener('keydown', on);" }),
    ).toBe(1);
    expect(
      countOf({
        id: 'window-key-listener',
        text: "document.addEventListener(\n 'keydown', on, { capture: true });",
      }),
    ).toBe(1);
    expect(
      countOf({ id: 'window-key-listener', text: "dialog.addEventListener('keydown', on);" }),
    ).toBe(0);
    expect(
      countOf({ id: 'window-key-listener', text: "window.addEventListener('keyup', on);" }),
    ).toBe(0);
  });

  it('keeps the stack, the dispatcher and the registry as the only exempt files', () => {
    const exempt = RULES.flatMap((rule) => [...rule.exempt]);

    expect([...new Set(exempt)].sort()).toEqual(
      [REGISTRY_ENTRIES, REGISTRY_HOME, STACK_HOME].sort(),
    );
  });

  it('adds no Escape literal or window key listener beyond the baseline', () => {
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
        `Escape or key handling grew outside the stack and the registry. docs/navigation.md, ` +
          `One Esc stack and Shortcuts, explain both. A cleanup that removes handlers ` +
          `regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });
});
