// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { productSources } from './scanControls';

const ROW_HEIGHTS: ReadonlyArray<number> = [24, 28, 32, 36, 40, 48];
const SPACING_PX = 4;
const SMALLEST_ROW_PX = 22;
const LARGEST_ROW_PX = 48;

const HEIGHT_UTILITY =
  /(?<![\w-])(?:[\w-]+:)*(?:min-h|h)-(?:\[(\d+(?:\.\d+)?)px\]|(\d+(?:\.\d+)?))(?![\w.-])/g;

type Pending = {
  readonly path: string;
  readonly owner: string;
};

const PENDING: ReadonlyArray<Pending> = [];

const NOT_A_ROW: ReadonlyArray<{ readonly path: string; readonly reason: string }> = [
  {
    path: 'packages/ui/src/components/DrawerFrame.tsx',
    reason: 'the drawer header is a bar, not a row',
  },
];

export const offScaleHeights = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(HEIGHT_UTILITY)].flatMap((match) => {
    const px = match[1] !== undefined ? Number(match[1]) : Number(match[2]) * SPACING_PX;
    const isRowBand = px >= SMALLEST_ROW_PX && px <= LARGEST_ROW_PX;
    return isRowBand && !ROW_HEIGHTS.includes(px) ? [match[0]] : [];
  });

describe('one-line rows sit on the row scale', () => {
  it('flags a height between 22 and 48px that is not 24, 28, 32, 36, 40 or 48', () => {
    expect(offScaleHeights('flex h-7.5 w-full')).toEqual(['h-7.5']);
    expect(offScaleHeights('flex min-h-[34px]')).toEqual(['min-h-[34px]']);
    expect(offScaleHeights('hover:h-6.5 md:h-8.5')).toEqual(['hover:h-6.5', 'md:h-8.5']);
    expect(offScaleHeights('h-6 h-7 h-8 h-9 h-10 h-12 min-h-8 h-[28px]')).toEqual([]);
    expect(offScaleHeights('h-0.5 h-1.5 h-2.5 h-3.5 h-4.5 h-5 max-h-[420px] h-full')).toEqual([]);
  });

  it('keeps every row height in the product on the scale', () => {
    const pendingPaths = new Set([...PENDING, ...NOT_A_ROW].map((entry) => entry.path));
    const offenders = productSources().flatMap(({ path, text }) =>
      pendingPaths.has(path)
        ? []
        : offScaleHeights(text).map((utility) => `  - ${path}: ${utility}`),
    );
    expect(
      offenders,
      `A one-line row or menu row is 24, 28, 32, 36, 40 or 48px. Fix the new code:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('points every pending entry at a file that still has an off-scale row', () => {
    const byPath = new Map(productSources().map((source) => [source.path, source.text]));
    const fixed = PENDING.filter(
      (entry) => offScaleHeights(byPath.get(entry.path) ?? '').length === 0,
    ).map((entry) => entry.path);
    expect(fixed, `Remove the pending entries that are fixed:\n${fixed.join('\n')}`).toEqual([]);
  });
});
