// @vitest-environment node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  countMatches,
  openingTags,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'scale-rules.baseline.json';
const MONO_CODE_FILE = 'scale-rules.mono-code.json';

const RULES = {
  iconSize: /\bsize=\{\d+\}/g,
  mono: /font-mono/g,
  uppercase: /uppercase[^'"`\n]*tracking-|tracking-[^'"`\n]*uppercase/g,
  gap: /(?<![\w-])(?:gap|space)-(?:x-|y-)?(?:5|7|10)(?![\w.-])/g,
} as const;

type Rule = keyof typeof RULES;

const RULE_NAMES = Object.keys(RULES) as ReadonlyArray<Rule>;

const NOT_AN_ICON: ReadonlyArray<string> = ['DogMascot', 'IntegrationGlyph', 'BrandGlyph', 'input'];

const MONO_REASONS: ReadonlySet<string> = new Set([
  'branch',
  'path',
  'command',
  'sha',
  'code',
  'identifier',
  'glyph',
]);

type Pending = {
  readonly path: string;
  readonly rule: Rule;
  readonly owner: string;
};

const PENDING: ReadonlyArray<Pending> = [
  {
    path: 'apps/desktop/src/features/session/components/SessionOverviewPane/HeaderBand.tsx',
    rule: 'mono',
    owner: 'd7-headers rewrites the header band',
  },
  {
    path: 'packages/ui/src/components/Notice/index.tsx',
    rule: 'iconSize',
    owner: 'c6-sweep rewrites the notice',
  },
  {
    path: 'packages/ui/src/components/EmptyLine.tsx',
    rule: 'iconSize',
    owner: 'c6-sweep rewrites the empty line',
  },
  {
    path: 'apps/desktop/src/features/integrations/gitlab/MergeRequest/MrDetailPanel/index.tsx',
    rule: 'iconSize',
    owner: 'e2-gitlab owns the adapter',
  },
];

const keyOf = ({ path, rule }: { readonly path: string; readonly rule: Rule }): string =>
  `${path}#${rule}`;

const readMonoCode = (): Readonly<Record<string, string>> => {
  const file = join(__dirname, MONO_CODE_FILE);
  if (!existsSync(file)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  return typeof parsed === 'object' && parsed !== null
    ? (parsed as Readonly<Record<string, string>>)
    : {};
};

const withoutNonIconTags = (text: string): string =>
  NOT_AN_ICON.reduce(
    (current, name) =>
      openingTags({ text: current, name }).reduce((rest, tag) => rest.replace(tag, ' '), current),
    text,
  );

const countRule = ({
  rule,
  text,
  path,
  monoCode,
}: {
  readonly rule: Rule;
  readonly text: string;
  readonly path: string;
  readonly monoCode: Readonly<Record<string, string>>;
}): number => {
  if (rule === 'mono' && monoCode[path] !== undefined) {
    return 0;
  }
  const scanned = rule === 'iconSize' ? withoutNonIconTags(text) : text;
  return countMatches({ text: scanned, pattern: RULES[rule] });
};

const measure = (): FileCounts => {
  const monoCode = readMonoCode();
  return Object.fromEntries(
    productSources().flatMap(({ path, text }) =>
      RULE_NAMES.flatMap((rule) => {
        const count = countRule({ rule, text, path, monoCode });
        return count > 0 ? [[keyOf({ path, rule }), count] as const] : [];
      }),
    ),
  );
};

describe('the scale rules for new code only ever shrink', () => {
  it('counts each violation and leaves the allowed forms alone', () => {
    const count = (rule: Rule, text: string): number =>
      countRule({ rule, text, path: 'x.tsx', monoCode: {} });

    expect(count('iconSize', '<Bell size={13} aria-hidden />')).toBe(1);
    expect(count('iconSize', '<Bell size={10} aria-hidden />')).toBe(1);
    expect(count('iconSize', '<Bell size={ICON_SIZE.mark} aria-hidden />')).toBe(0);
    expect(count('iconSize', '<Bell size={ICON_SIZE.row} aria-hidden />')).toBe(0);
    expect(count('iconSize', '<DogMascot size={64} className="text-primary" />')).toBe(0);
    expect(count('iconSize', '<input size={40} />')).toBe(0);
    expect(count('mono', 'className="font-mono text-meta"')).toBe(1);
    expect(
      countRule({
        rule: 'mono',
        text: 'className="font-mono"',
        path: 'a.tsx',
        monoCode: { 'a.tsx': 'sha' },
      }),
    ).toBe(0);
    expect(count('uppercase', "'uppercase tracking-wide text-meta'")).toBe(1);
    expect(count('uppercase', "'text-meta'")).toBe(0);
    expect(count('gap', 'className="flex gap-5"')).toBe(1);
    expect(count('gap', 'className="flex gap-x-7 gap-y-10"')).toBe(2);
    expect(count('gap', 'className="grid gap-x-5 md:gap-y-5"')).toBe(2);
    expect(count('gap', 'className="space-y-5 space-x-7"')).toBe(2);
    expect(count('gap', 'className="flex gap-4 gap-2.5 gap-0.5 gap-6 gap-8"')).toBe(0);
  });

  it('adds no off-scale icon, non-code mono line, hand-rolled uppercase or odd gap beyond the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const baseline = readBaseline({ file: BASELINE_FILE });
    const grown = Object.entries(current).flatMap(([key, count]) => {
      const allowed = baseline[key] ?? 0;
      return count > allowed ? [`  - ${key}: ${count} (baseline ${allowed})`] : [];
    });
    expect(
      grown,
      `Icons use ICON_SIZE (mark 10, row 12, control 14, hero 18), mono is for branch, path, command, sha and code (numbers are sans with tabular-nums), uppercase goes through Eyebrow, gaps sit on 4, 8, 12, 16, 24 and 32. Fix the new code:\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps a baseline entry only for a file a named owner still has to change', () => {
    const baseline = readBaseline({ file: BASELINE_FILE });
    const allowed = new Set(PENDING.map(keyOf));
    const stray = Object.keys(baseline).filter((key) => !allowed.has(key));
    expect(
      stray,
      `The baseline reaches zero apart from the pending list in this test:\n${stray.join('\n')}`,
    ).toEqual([]);
  });

  it('points every pending entry at a file that still has the violation', () => {
    const current = measure();
    const stale = PENDING.filter((entry) => (current[keyOf(entry)] ?? 0) === 0).map(keyOf);
    expect(stale, `Remove the pending entries that are fixed:\n${stale.join('\n')}`).toEqual([]);
  });

  it('lists a one-word reason for every file whose font-mono is code, and no stale file', () => {
    const monoCode = readMonoCode();
    const byPath = new Map(productSources().map((source) => [source.path, source.text]));
    const problems = Object.entries(monoCode).flatMap(([path, reason]) => {
      const text = byPath.get(path);
      if (text === undefined) {
        return [`${path}: file is gone`];
      }
      if (!MONO_REASONS.has(reason)) {
        return [`${path}: reason "${reason}" is not one of ${[...MONO_REASONS].join(', ')}`];
      }
      return text.includes('font-mono') ? [] : [`${path}: no font-mono left`];
    });
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
