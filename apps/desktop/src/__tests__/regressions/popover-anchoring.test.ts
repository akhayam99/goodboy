// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const UI_SRC = join(REPO_ROOT, 'packages', 'ui', 'src');
const BASELINE_PATH = join(__dirname, 'popover-anchoring.baseline.json');

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const START_VALUES: ReadonlySet<string> = new Set(["'start'", "'left'", 'align']);
const BOTTOM_VALUES: ReadonlySet<string> = new Set(["'bottom'", 'side']);

const CALL_OPENER = /\buseDropdown(?:Direction)?\(\{/g;
const BODY_PROPERTY = /\b(align|side)\s*:\s*([^,\n}]+)/g;
const ALIGN_DEFAULT = /\balign = '(\w+)'/g;
const JSX_ALIGN = /\balign=(?:"(\w+)"|\{([^}]+)\})/g;

type Allowlist = Readonly<Record<string, Readonly<Record<string, number>>>>;

type BodyParams = {
  readonly text: string;
  readonly from: number;
};

const walk = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const toPath = (full: string): string => relative(REPO_ROOT, full).split(sep).join('/');

const isSource = (full: string): boolean =>
  /\.tsx?$/.test(full) &&
  !/\.(test|stories)\.tsx?$/.test(full) &&
  !full.includes(`${sep}MockScene${sep}`) &&
  !full.includes(`${sep}__tests__${sep}`) &&
  !full.includes(`${sep}test${sep}`);

const sources = (): ReadonlyArray<string> =>
  [...walk(DESKTOP_SRC), ...walk(UI_SRC)].filter(isSource);

const bodyAt = ({ text, from }: BodyParams): string => {
  let depth = 0;
  for (let index = from; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') {
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(from, index + 1);
      }
    }
  }
  return text.slice(from);
};

const callOverrides = (text: string): number =>
  Array.from(text.matchAll(CALL_OPENER)).reduce((total, match) => {
    const body = bodyAt({ text, from: (match.index ?? 0) + match[0].length - 1 });
    const overrides = Array.from(body.matchAll(BODY_PROPERTY)).filter(([, key, value]) => {
      const trimmed = (value ?? '').trim();
      return key === 'align' ? !START_VALUES.has(trimmed) : !BOTTOM_VALUES.has(trimmed);
    });
    return total + overrides.length;
  }, 0);

const defaultOverrides = (text: string): number =>
  Array.from(text.matchAll(ALIGN_DEFAULT)).filter(
    ([, value]) => !START_VALUES.has(`'${value ?? ''}'`),
  ).length;

const jsxOverrides = (text: string): number =>
  Array.from(text.matchAll(JSX_ALIGN)).filter(([, literal, expression]) => {
    if (literal !== undefined) {
      return !START_VALUES.has(`'${literal}'`);
    }
    return !START_VALUES.has((expression ?? '').trim());
  }).length;

const anchorOverridesIn = (text: string): number =>
  callOverrides(text) + defaultOverrides(text) + jsxOverrides(text);

const measure = (): Readonly<Record<string, number>> =>
  Object.fromEntries(
    sources()
      .map((full) => [toPath(full), anchorOverridesIn(readFileSync(full, 'utf8'))] as const)
      .filter(([, count]) => count > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

const isAllowlist = (value: unknown): value is Allowlist =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every(
    (reasons) =>
      typeof reasons === 'object' &&
      reasons !== null &&
      Object.values(reasons).every((count) => typeof count === 'number'),
  );

const readAllowlist = (): Allowlist => {
  if (!existsSync(BASELINE_PATH)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return isAllowlist(parsed) ? parsed : {};
};

const allowedIn = (reasons: Readonly<Record<string, number>> | undefined): number =>
  Object.values(reasons ?? {}).reduce((total, count) => total + count, 0);

const readSource = (path: string): string => readFileSync(join(REPO_ROOT, path), 'utf8');

describe('every popover opens under its trigger, start aligned', () => {
  it('counts side and align overrides in calls, defaults and props', () => {
    expect(anchorOverridesIn("useDropdown({ align: 'end', width: 'w-80' })")).toBe(1);
    expect(anchorOverridesIn("useDropdown({\n  side: 'right',\n  align: 'end',\n})")).toBe(2);
    expect(anchorOverridesIn("useDropdown({ align: 'start', side: 'bottom' })")).toBe(0);
    expect(anchorOverridesIn('useDropdown({ disabled, align, width })')).toBe(0);
    expect(anchorOverridesIn("useDropdown({ align: isRow ? 'end' : 'start' })")).toBe(1);
    expect(anchorOverridesIn("export const Menu = ({ align = 'end' }: Props) => null;")).toBe(1);
    expect(anchorOverridesIn('<Listbox align="end" value={value} />')).toBe(1);
    expect(anchorOverridesIn('<Listbox align="start" />')).toBe(0);
    expect(anchorOverridesIn('<ConfirmPopover align={align} />')).toBe(0);
  });

  it('opens the shared popover and select primitives at side bottom, align start', () => {
    const dropdown = readSource('packages/ui/src/useDropdown/index.ts');
    expect(dropdown).toContain("side = 'bottom',");
    expect(dropdown).toContain("align = 'start',");
    expect(readSource('packages/ui/src/useDropdownDirection.ts')).toContain("side = 'bottom',");
    expect(readSource('packages/ui/src/components/Listbox/index.tsx')).toContain(
      "align = 'start',",
    );
    expect(readSource('apps/desktop/src/shared/components/RoutingPicker/index.tsx')).toContain(
      "align = 'start',",
    );
    expect(readSource('apps/desktop/src/shared/components/ModelControlChip.tsx')).not.toMatch(
      /align: '(?!start)/,
    );
  });

  it('gives every allowlisted override a reason', () => {
    const reasons = Object.values(readAllowlist()).flatMap((entry) => Object.keys(entry));
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.filter((reason) => reason.trim().length < 12)).toEqual([]);
  });

  it('lets no file override the anchor beyond its allowlist, and the allowlist only falls', () => {
    const current = measure();
    const allowlist = readAllowlist();
    const paths = new Set([...Object.keys(current), ...Object.keys(allowlist)]);
    const drift = [...paths].sort().flatMap((path) => {
      const count = current[path] ?? 0;
      const allowed = allowedIn(allowlist[path]);
      if (count > allowed) {
        return [
          `${path}: ${count} side or align overrides, allowlist ${allowed}. Open under the trigger, start aligned, or add a reason.`,
        ];
      }
      if (count < allowed) {
        return [`${path}: ${count} overrides, allowlist ${allowed}. Lower the allowlist.`];
      }
      return [];
    });
    expect(drift).toEqual([]);
  });
});
