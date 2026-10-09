// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  countMatches,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'scale-rules.baseline.json';

const RULES = {
  iconSize: /\bsize=\{\d+\}/g,
  mono: /font-mono/g,
  uppercase: /uppercase[^'"`\n]*tracking-|tracking-[^'"`\n]*uppercase/g,
  gap: /(?<![\w-])gap-(?:x-|y-)?(?:5|7|10)(?![\w.-])/g,
} as const;

type Rule = keyof typeof RULES;

const RULE_NAMES = Object.keys(RULES) as ReadonlyArray<Rule>;

const keyOf = ({ path, rule }: { readonly path: string; readonly rule: Rule }): string =>
  `${path}#${rule}`;

const measure = (): FileCounts =>
  Object.fromEntries(
    productSources().flatMap(({ path, text }) =>
      RULE_NAMES.flatMap((rule) => {
        const count = countMatches({ text, pattern: RULES[rule] });
        return count > 0 ? [[keyOf({ path, rule }), count] as const] : [];
      }),
    ),
  );

describe('the scale rules for new code only ever shrink', () => {
  it('counts each violation and leaves the allowed forms alone', () => {
    const count = (rule: Rule, text: string): number =>
      countMatches({ text, pattern: RULES[rule] });

    expect(count('iconSize', '<Bell size={13} aria-hidden />')).toBe(1);
    expect(count('iconSize', '<Bell size={ICON_SIZE.row} aria-hidden />')).toBe(0);
    expect(count('mono', 'className="font-mono text-meta"')).toBe(1);
    expect(count('uppercase', "'uppercase tracking-wide text-meta'")).toBe(1);
    expect(count('uppercase', "'text-meta'")).toBe(0);
    expect(count('gap', 'className="flex gap-5"')).toBe(1);
    expect(count('gap', 'className="flex gap-x-7 gap-y-10"')).toBe(2);
    expect(count('gap', 'className="flex gap-4 gap-2.5 gap-0.5"')).toBe(0);
  });

  it('adds no off-scale icon, mono line, hand-rolled uppercase or odd gap beyond the baseline', () => {
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
      `Icons use ICON_SIZE (row 12, control 14, hero 18), mono is for branch, path, command, sha and code, uppercase goes through Eyebrow, gaps sit on 4, 8, 12, 16, 24 and 32. Fix the new code:\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
