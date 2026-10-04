// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const BASELINE_PATH = join(__dirname, 'hand-made-notices-and-empty-lines.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const OWNERS: ReadonlySet<string> = new Set([
  'packages/ui/src/components/Notice/index.tsx',
  'packages/ui/src/components/EmptyLine.tsx',
]);

const HAND_MADE_NOTICE = /bg-subtle px-4 py-3(?![.\d])/g;
const BARE_EMPTY_LINE = /<p className="[^"]*text-(?:faint|muted)-foreground[^"]*">\s*No [a-z]/g;

type Counts = Readonly<Record<string, Readonly<{ notices: number; emptyLines: number }>>>;

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

const isProductComponent = (path: string): boolean =>
  path.endsWith('.tsx') && !/\.test\.tsx$/.test(path) && !OWNERS.has(path);

type TextParams = {
  readonly text: string;
};

const countNotices = ({ text }: TextParams): number => (text.match(HAND_MADE_NOTICE) ?? []).length;

const countEmptyLines = ({ text }: TextParams): number =>
  (text.match(BARE_EMPTY_LINE) ?? []).length;

const measure = (): Counts =>
  Object.fromEntries(
    [join(REPO_ROOT, 'apps', 'desktop', 'src'), join(REPO_ROOT, 'packages', 'ui', 'src')]
      .flatMap(walk)
      .map(toPath)
      .filter(isProductComponent)
      .sort((left, right) => left.localeCompare(right))
      .map((path) => {
        const text = readFileSync(join(REPO_ROOT, path), 'utf8');
        const counts = { notices: countNotices({ text }), emptyLines: countEmptyLines({ text }) };
        return [path, counts] as const;
      })
      .filter(([, counts]) => counts.notices + counts.emptyLines > 0),
  );

const isCounts = (value: unknown): value is Counts =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.notices === 'number' &&
      typeof entry.emptyLines === 'number',
  );

const readBaseline = (): Counts => {
  if (!existsSync(BASELINE_PATH)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return isCounts(parsed) ? parsed : {};
};

describe('hand-made notices and bare empty lines only ever shrink', () => {
  it('counts a hand-rolled notice surface and a bare empty sentence', () => {
    expect(countNotices({ text: "'flex flex-col gap-2 bg-subtle px-4 py-3'" })).toBe(1);
    expect(countNotices({ text: "'rounded-lg bg-subtle px-4 py-3.5'" })).toBe(0);
    expect(
      countEmptyLines({ text: '<p className="text-meta text-muted-foreground">No notes.' }),
    ).toBe(1);
    expect(countEmptyLines({ text: '<EmptyLine>No notes on this screen.</EmptyLine>' })).toBe(0);
  });

  it('keeps the surfaces this round moved off hand-made shapes', () => {
    const current = measure();

    expect(
      Object.keys(current).filter(
        (path) =>
          path.endsWith('/MoveReport/index.tsx') ||
          path.endsWith('/ThreadVerdictCard.tsx') ||
          path.endsWith('/SourceChangeCard.tsx') ||
          path.endsWith('/NotesPanel.tsx') ||
          path.endsWith('/GoalTab.tsx') ||
          path.endsWith('/DescriptionSection/index.tsx') ||
          path.endsWith('/PrOverview.tsx'),
      ),
    ).toEqual([]);
  });

  it('adds no hand-made notice or bare empty line to any file beyond its baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const grown = Object.entries(current).flatMap(([path, counts]) => {
      const allowed = baseline[path] ?? { notices: 0, emptyLines: 0 };
      return counts.notices > allowed.notices || counts.emptyLines > allowed.emptyLines
        ? [`  - ${path}: ${JSON.stringify(counts)} (baseline ${JSON.stringify(allowed)})`]
        : [];
    });
    if (grown.length > 0) {
      throw new Error(
        `Hand-made notices or bare empty lines grew. Use Notice or EmptyLine from @goodboy/ui ` +
          `(DESIGN-SYSTEM.md, Empty states). A cleanup regenerates the baseline with ` +
          `GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });
});
