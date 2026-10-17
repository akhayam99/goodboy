// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { PANE_RHYTHM as RHYTHM } from '@goodboy/ui';
import { RAIL_NODE_CENTER_Y, RAIL_ROW_HEIGHT } from '../../features/auto/chat/railSpec';

const DESKTOP_SRC = join(__dirname, '..', '..');
const UI_SRC = join(DESKTOP_SRC, '..', '..', '..', 'packages', 'ui', 'src');

const PANE_RHYTHM = join(UI_SRC, 'paneRhythm.ts');
const WORK_META_SPEC = join(UI_SRC, 'components', 'WorkTree', 'workMetaSpec.ts');
const TIMELINE_RHYTHM = join(DESKTOP_SRC, 'features', 'workTreeModel', 'timelineRhythm.ts');

const ROW_HEIGHTS: ReadonlyArray<number> = [24, 28, 32, 36, 40, 48];
const SPACING_PX = 4;

const HALF_STEP =
  /(?<![\w-])(?:[\w-]+:)*-?(?:p|px|py|pt|pb|pl|pr|ps|pe|gap|gap-x|gap-y|m|mx|my|mt|mb|ml|mr|space-x|space-y|min-h|h)-(?:[1-9]\d*|0)\.5(?![\w-])/g;

const source = ({ path }: { path: string }): string => readFileSync(path, 'utf8');

const halfSteps = ({ path }: { path: string }): ReadonlyArray<string> =>
  [...source({ path }).matchAll(HALF_STEP)].map((match) => match[0]);

const navRailBlock = (): string => {
  const match = /navRail: \{([^}]*)\}/.exec(source({ path: PANE_RHYTHM }));
  if (match === null) {
    throw new Error('paneRhythm.ts must declare a navRail block');
  }
  return String(match[1]);
};

describe('spacing grid', () => {
  it.each([
    ['paneRhythm.ts', PANE_RHYTHM],
    ['workMetaSpec.ts', WORK_META_SPEC],
    ['timelineRhythm.ts', TIMELINE_RHYTHM],
  ])('keeps %s on whole 4px steps, with no half step', (_name, path) => {
    expect(halfSteps({ path })).toEqual([]);
  });

  it('sets every timeline row and band height on the row scale', () => {
    const heights = [...source({ path: TIMELINE_RHYTHM }).matchAll(/\bheight: (\d+)/g)].map(
      (match) => Number(match[1]),
    );

    expect(heights.length).toBeGreaterThan(0);
    expect(heights.filter((height) => !ROW_HEIGHTS.includes(height))).toEqual([]);
  });

  it('sets the work rail row on the scale, two lines of 28 and 20 with the node on the first', () => {
    expect(ROW_HEIGHTS).toContain(RAIL_ROW_HEIGHT);
    expect(RAIL_ROW_HEIGHT).toBe(48);
    expect(RAIL_NODE_CENTER_Y * 2).toBe(28);
    expect(RAIL_ROW_HEIGHT - RAIL_NODE_CENTER_Y * 2).toBe(20);
  });

  it('names the property grid and the tree row in the pane rhythm, on the scale', () => {
    expect(RHYTHM.property.grid).toContain('grid-cols-[88px_minmax(0,1fr)]');
    expect(RHYTHM.property.label).toContain('h-7');
    expect(RHYTHM.property.value).toContain('min-h-7');
    expect(RHYTHM.tree.row).toBe('min-h-12');
    const treeHeights = [RHYTHM.tree.row, RHYTHM.tree.line, RHYTHM.tree.meta].map(
      (utility) => Number(/-(\d+)$/.exec(utility)?.[1] ?? 0) * SPACING_PX,
    );
    expect(treeHeights).toEqual([48, 28, 20]);
  });

  it('sets every nav rail row minimum height on the row scale', () => {
    const heights = [...navRailBlock().matchAll(/\bmin-h-(\d+)\b/g)].map(
      (match) => Number(match[1]) * SPACING_PX,
    );

    expect(heights.length).toBeGreaterThan(0);
    expect(heights.filter((height) => !ROW_HEIGHTS.includes(height))).toEqual([]);
  });
});
