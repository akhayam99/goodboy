// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

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

  it('sets every nav rail row minimum height on the row scale', () => {
    const heights = [...navRailBlock().matchAll(/\bmin-h-(\d+)\b/g)].map(
      (match) => Number(match[1]) * SPACING_PX,
    );

    expect(heights.length).toBeGreaterThan(0);
    expect(heights.filter((height) => !ROW_HEIGHTS.includes(height))).toEqual([]);
  });
});
