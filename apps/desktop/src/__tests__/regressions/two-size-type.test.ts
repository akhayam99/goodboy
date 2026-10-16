// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { productSources } from './scanControls';

const GRID_SURFACE = /<ListGrid\b|from '\.\/listGridTemplate'/;

const OTHER_ROLE =
  /(?<![\w-])text-(?:display|title|heading|body|prose|label|eyebrow|meta|chip|code)(?![\w-])/g;

type ProblemParams = {
  readonly text: string;
};

const otherRolesIn = ({ text }: ProblemParams): ReadonlyArray<string> => [
  ...new Set(text.match(OTHER_ROLE) ?? []),
];

describe('two size type on ListGrid surfaces', () => {
  it('finds the ListGrid primitive itself, so the scan cannot go blind', () => {
    const paths = productSources()
      .filter(({ text }) => GRID_SURFACE.test(text))
      .map(({ path }) => path);
    expect(paths).toContain('packages/ui/src/components/ListGrid/ListGrid.tsx');
  });

  it('keeps every file that renders a ListGrid on text-ui, text-row, text-read and text-lead', () => {
    const offenders = productSources()
      .filter(({ text }) => GRID_SURFACE.test(text))
      .flatMap(({ path, text }) => otherRolesIn({ text }).map((role) => `${path}: ${role}`));
    expect(
      offenders,
      `A ListGrid surface reads in two sizes: text-ui or text-row for lines, text-read or text-lead for title and prose (DESIGN-SYSTEM.md, Two sizes per region).\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
