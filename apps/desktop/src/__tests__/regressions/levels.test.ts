// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { TYPE_ROLES } from '@goodboy/ui';
import { productSources } from './scanControls';

const css = readFileSync(join(__dirname, '..', '..', 'styles.css'), 'utf8');

const GRID_SURFACE = /<ListGrid\b|from '\.\/listGridTemplate'/;

const OFF_LEVEL_ROLE = /(?<![\w-])text-(?:display|body|eyebrow|read)(?![\w-])/g;

const LEVELS = [
  { level: 1, role: 'title', size: 18, lineHeight: 28 },
  { level: 2, role: 'heading', size: 14, lineHeight: 20 },
  { level: 3, role: 'prose', size: 15, lineHeight: 24 },
  { level: 4, role: 'row', size: 13, lineHeight: 20 },
  { level: 5, role: 'meta', size: 12, lineHeight: 16 },
] as const;

type TokenParams = {
  readonly token: string;
};

const tokenPx = ({ token }: TokenParams): number => {
  const match = new RegExp(`${token}:\\s*(\\d+)px;`).exec(css);
  if (match === null) {
    throw new Error(`styles.css must declare ${token} in px`);
  }
  return Number(match[1]);
};

type ProblemParams = {
  readonly text: string;
};

const offLevelRolesIn = ({ text }: ProblemParams): ReadonlyArray<string> => [
  ...new Set(text.match(OFF_LEVEL_ROLE) ?? []),
];

describe('the five text levels', () => {
  it.each(LEVELS)('level $level, $role, is $size on a $lineHeight line', (entry) => {
    expect(tokenPx({ token: `--text-${entry.role}` })).toBe(entry.size);
    expect(tokenPx({ token: `--text-${entry.role}--line-height` })).toBe(entry.lineHeight);
  });

  it('steps down from title to meta: 18, 15, 14, 13, 12', () => {
    const sizes = ['title', 'prose', 'heading', 'row', 'meta'].map((role) =>
      tokenPx({ token: `--text-${role}` }),
    );
    expect(sizes).toEqual([18, 15, 14, 13, 12]);
  });

  it('tightens the title by 0.012em and weighs it 600', () => {
    expect(css).toContain('--text-title--letter-spacing: -0.012em;');
    expect(css).toContain('--text-title--font-weight: 600;');
  });

  it('keeps one reading level: text-read is merged into text-prose', () => {
    expect(TYPE_ROLES).not.toContain('read');
    expect(css).not.toMatch(/--text-read\b/);
    const offenders = productSources()
      .filter(({ text }) => /(?<![\w-])text-read(?![\w-])/.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});

describe('levels on ListGrid surfaces', () => {
  it('finds the ListGrid primitive itself, so the scan cannot go blind', () => {
    const paths = productSources()
      .filter(({ text }) => GRID_SURFACE.test(text))
      .map(({ path }) => path);
    expect(paths).toContain('packages/ui/src/components/ListGrid/ListGrid.tsx');
  });

  it('keeps every file that renders a ListGrid on the five levels, text-ui, text-lead and text-code', () => {
    const offenders = productSources()
      .filter(({ text }) => GRID_SURFACE.test(text))
      .flatMap(({ path, text }) => offLevelRolesIn({ text }).map((role) => `${path}: ${role}`));
    expect(
      offenders,
      `A ListGrid surface reads in the five levels (DESIGN-SYSTEM.md, Five levels): title, heading, prose, row or ui, meta. text-display, text-body and text-eyebrow are off the ladder.\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
