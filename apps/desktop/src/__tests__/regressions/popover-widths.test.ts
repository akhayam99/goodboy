// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const UI_SRC = join(REPO_ROOT, 'packages', 'ui', 'src');
const BASELINE_PATH = join(__dirname, 'popover-widths.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const SCALE_PX: ReadonlySet<number> = new Set([200, 240, 320, 360, 384, 420]);
const NAMED_PX: Readonly<Record<string, number>> = {
  xs: 320,
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
};

const SURFACE_LINE = /bg-floating|FLOATING_SURFACE|z-popover/;
const DROPDOWN_WIDTH = /useDropdown\(\{[^}]*?\bwidth:\s*'([^']+)'/g;
const WIDTH_CONSTANT = /\bconst\s+[A-Z_]*(?:PANEL|MENU|CARD|POPOVER)_WIDTH\s*=\s*(\d+)/g;
const WIDTH_CLASS =
  /(?<![\w-])(?:min-w|max-w|w)-(\[[\d.]+(?:px|rem)\]|\d+(?:\.\d+)?|xs|sm|md|lg|xl)/g;

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

const pxOf = (token: string): number | null => {
  const named = NAMED_PX[token];
  if (named !== undefined) {
    return named;
  }
  const arbitrary = /^\[([\d.]+)(px|rem)\]$/.exec(token);
  if (arbitrary !== null) {
    return Number(arbitrary[1]) * (arbitrary[2] === 'rem' ? 16 : 1);
  }
  const step = Number(token);
  return Number.isNaN(step) ? null : step * 4;
};

const classWidthsIn = (text: string): ReadonlyArray<number> =>
  Array.from(text.matchAll(WIDTH_CLASS)).flatMap((match) => {
    const px = pxOf(match[1] ?? '');
    return px === null || px === 0 ? [] : [px];
  });

const floatingWidthsOf = (text: string): ReadonlyArray<number> => [
  ...Array.from(text.matchAll(WIDTH_CONSTANT)).map((match) => Number(match[1])),
  ...Array.from(text.matchAll(DROPDOWN_WIDTH)).flatMap((match) => classWidthsIn(match[1] ?? '')),
  ...text
    .split('\n')
    .filter((line) => SURFACE_LINE.test(line))
    .flatMap((line) => classWidthsIn(line)),
];

const offScaleCount = (text: string): number =>
  floatingWidthsOf(text).filter((px) => !SCALE_PX.has(px)).length;

const isSource = (full: string): boolean =>
  /\.tsx?$/.test(full) &&
  !/\.(test|stories)\.tsx?$/.test(full) &&
  !full.includes(`${sep}MockScene${sep}`) &&
  !full.includes(`${sep}__tests__${sep}`);

const sources = (): ReadonlyArray<string> =>
  [...walk(DESKTOP_SRC), ...walk(UI_SRC)].filter(isSource);

const measure = (): Counts =>
  Object.fromEntries(
    sources()
      .map((full) => [toPath(full), offScaleCount(readFileSync(full, 'utf8'))] as const)
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

describe('floating surfaces use the width scale', () => {
  it('reads the widths a floating surface declares', () => {
    expect(
      floatingWidthsOf("useDropdown({ align: 'end', width: 'w-64', expectedHeight: 96 })"),
    ).toEqual([256]);
    expect(floatingWidthsOf("useDropdown({\n  align: 'end',\n  width: 'w-72',\n})")).toEqual([288]);
    expect(floatingWidthsOf("useDropdown({ width: 'min-w-[200px]' })")).toEqual([200]);
    expect(floatingWidthsOf('const PANEL_WIDTH = 300;')).toEqual([300]);
    expect(
      floatingWidthsOf('<div className="fixed z-popover w-[368px] max-w-[calc(100vw-2rem)]">'),
    ).toEqual([368]);
    expect(floatingWidthsOf('<div className="relative w-full max-w-105 bg-floating">')).toEqual([
      420,
    ]);
    expect(floatingWidthsOf('<div className="w-72 rounded-lg">')).toEqual([]);
  });

  it('keeps the scale: menus 240 (min 200), popovers 320 and 384, toast 360, switcher 420', () => {
    expect([...SCALE_PX].sort((left, right) => left - right)).toEqual([
      200, 240, 320, 360, 384, 420,
    ]);
  });

  it('finds floating surfaces, never an empty sweep', () => {
    const seen = sources().filter(
      (full) => floatingWidthsOf(readFileSync(full, 'utf8')).length > 0,
    );
    expect(seen.length).toBeGreaterThan(10);
  });

  it('lets no file declare more off-scale widths than its baseline', () => {
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
            `${path}: ${count} off-scale widths, baseline ${allowed}. Use 200, 240, 320, 360, 384 or 420.`,
          ]
        : [];
    });
    expect(grown).toEqual([]);
  });
});
