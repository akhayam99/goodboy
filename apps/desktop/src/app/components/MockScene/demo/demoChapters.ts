import type { DemoHint } from './hints/demoHintTypes';
import { BRING_HINTS } from './hints/bringHints';
import { DIRECTION_HINTS } from './hints/directionHints';
import { GUIDE_HINTS } from './hints/guideHints';
import { SHIP_HINTS } from './hints/shipHints';
import { DEMO_GROUPS, type DemoGroup } from './demoGroups';

export type DemoBeat = {
  readonly scene: string;
  readonly params?: Readonly<Record<string, string>>;
};

export type DemoChapter = DemoGroup & {
  readonly hints: ReadonlyArray<DemoHint>;
  readonly beats: ReadonlyArray<DemoBeat>;
};

export const DEMO_CHAPTERS: readonly [DemoChapter, ...ReadonlyArray<DemoChapter>] = [
  {
    ...DEMO_GROUPS.bring,
    hints: BRING_HINTS,
    beats: [
      {
        scene: 'onboarding',
        params: { step: 'agents', pick: 'folder', github: 'none' },
      },
    ],
  },
  {
    ...DEMO_GROUPS.direction,
    hints: DIRECTION_HINTS,
    beats: [{ scene: 'story-direction' }],
  },
  {
    ...DEMO_GROUPS.guide,
    hints: GUIDE_HINTS,
    beats: [{ scene: 'story-plan' }],
  },
  {
    ...DEMO_GROUPS.ship,
    hints: SHIP_HINTS,
    beats: [{ scene: 'story-review' }, { scene: 'demo-storage' }],
  },
];
