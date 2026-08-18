import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { PANE_RHYTHM } from '@goodboy/ui';

const STYLES = join(__dirname, '..', '..', 'styles.css');

const RAIL_GLYPH_PX = 14;
const COUNT_CHIP_PADDING_STEP = 0.5;
const KBD_PILL_HEIGHT_STEP = 5;
const GROUP_LABEL_PADDING_STEP = 1;
const ROW_GAP_STEP = 0.5;
const GROUP_GAP_STEP = 4;
const SCALE_STEP = /^[a-z]+(?:-[a-z]+)*-(\d+(?:\.5)?)$/;

const readTokenPx = ({ token }: { token: string }): number => {
  const css = readFileSync(STYLES, 'utf8');
  const match = new RegExp(`${token}:\\s*(\\d+(?:\\.\\d+)?)px\\s*;`).exec(css);
  if (match === null) {
    throw new Error(`styles.css must declare ${token} as a px value`);
  }
  return Number(match[1]);
};

const SPACING_PX = readTokenPx({ token: '--spacing' });
const LEADING_3XS_PX = readTokenPx({ token: '--text-3xs--line-height' });
const LEADING_2XS_PX = readTokenPx({ token: '--text-2xs--line-height' });
const LEADING_SM_PX = readTokenPx({ token: '--text-sm--line-height' });

const step = ({ multiplier }: { multiplier: number }): number => multiplier * SPACING_PX;

const utilitiesOf = ({ classes }: { classes: string }): ReadonlyArray<string> =>
  classes.split(/\s+/).filter((utility) => utility.length > 0);

const blockPaddingPx = ({ classes }: { classes: string }): number => {
  let total = 0;
  for (const utility of utilitiesOf({ classes })) {
    const match = /^(p|py|pt|pb)-(\d+(?:\.\d+)?)$/.exec(utility);
    if (match === null) {
      continue;
    }
    const edge = step({ multiplier: Number(match[2]) });
    total += match[1] === 'pt' || match[1] === 'pb' ? edge : edge * 2;
  }
  return total;
};

const COUNT_CHIP_PX = LEADING_2XS_PX + step({ multiplier: COUNT_CHIP_PADDING_STEP }) * 2;
const KBD_PILL_PX = step({ multiplier: KBD_PILL_HEIGHT_STEP });
const ROW_CONTENT_PX = Math.max(RAIL_GLYPH_PX, LEADING_SM_PX, COUNT_CHIP_PX, KBD_PILL_PX);
const ROW_PX = blockPaddingPx({ classes: PANE_RHYTHM.navRail.row }) + ROW_CONTENT_PX;
const GROUP_LABEL_PX = LEADING_3XS_PX + step({ multiplier: GROUP_LABEL_PADDING_STEP });

const isWhole = (value: number): boolean => Number.isInteger(value);

const railColumnOffsets = ({
  groups,
}: {
  groups: ReadonlyArray<{ readonly hasLabel: boolean; readonly rows: number }>;
}): ReadonlyArray<number> => {
  const offsets: number[] = [];
  let cursor = blockPaddingPx({ classes: PANE_RHYTHM.navRail.body }) / 2;
  for (const [index, group] of groups.entries()) {
    if (index > 0) {
      cursor += step({ multiplier: GROUP_GAP_STEP });
    }
    if (group.hasLabel) {
      offsets.push(cursor);
      cursor += GROUP_LABEL_PX + step({ multiplier: ROW_GAP_STEP });
    }
    for (let row = 0; row < group.rows; row += 1) {
      offsets.push(cursor);
      cursor += ROW_PX;
      if (row < group.rows - 1) {
        cursor += step({ multiplier: ROW_GAP_STEP });
      }
    }
  }
  return offsets;
};

describe('lens rail whole-pixel geometry', () => {
  it('keeps the spacing base an even whole pixel, so every half step is whole', () => {
    expect(isWhole(SPACING_PX)).toBe(true);
    expect(SPACING_PX % 2).toBe(0);
    expect(isWhole(step({ multiplier: 0.5 }))).toBe(true);
  });

  it('pins a whole line box on every text size the rail composes', () => {
    expect([LEADING_3XS_PX, LEADING_2XS_PX, LEADING_SM_PX].filter((px) => !isWhole(px))).toEqual(
      [],
    );
    expect(LEADING_3XS_PX).toBeGreaterThan(readTokenPx({ token: '--text-3xs' }));
    expect(LEADING_2XS_PX).toBeGreaterThan(readTokenPx({ token: '--text-2xs' }));
    expect(LEADING_SM_PX).toBeGreaterThan(readTokenPx({ token: '--text-sm' }));
  });

  it('builds the rail rhythm from spacing-scale steps, never an arbitrary value', () => {
    const offScale = [
      PANE_RHYTHM.navRail.inset,
      PANE_RHYTHM.navRail.body,
      PANE_RHYTHM.navRail.row,
    ].flatMap((classes) => utilitiesOf({ classes }).filter((utility) => !SCALE_STEP.test(utility)));
    expect(offScale).toEqual([]);
  });

  it('keeps a badged row exactly as tall as a bare row', () => {
    expect(COUNT_CHIP_PX).toBeLessThanOrEqual(LEADING_SM_PX);
    expect(KBD_PILL_PX).toBeLessThanOrEqual(LEADING_SM_PX);
    expect(ROW_CONTENT_PX).toBe(LEADING_SM_PX);
  });

  it('lands the row box and the group label on whole pixels', () => {
    expect(isWhole(ROW_PX)).toBe(true);
    expect(isWhole(GROUP_LABEL_PX)).toBe(true);
    expect(isWhole(step({ multiplier: ROW_GAP_STEP }))).toBe(true);
    expect(isWhole(step({ multiplier: GROUP_GAP_STEP }))).toBe(true);
  });

  it('lands every row of a grouped rail column on a whole pixel', () => {
    const offsets = railColumnOffsets({
      groups: [
        { hasLabel: false, rows: 2 },
        { hasLabel: true, rows: 7 },
        { hasLabel: true, rows: 3 },
        { hasLabel: true, rows: 6 },
      ],
    });
    expect(offsets).toHaveLength(21);
    expect(offsets.filter((offset) => !isWhole(offset))).toEqual([]);
  });
});
