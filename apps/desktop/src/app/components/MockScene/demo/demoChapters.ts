import type { DemoHint } from './hints/demoHintTypes';
import { BRING_HINTS } from './hints/bringHints';
import { DIRECTION_HINTS } from './hints/directionHints';
import { GUIDE_HINTS } from './hints/guideHints';
import { SHIP_HINTS } from './hints/shipHints';
import { DEMO_GROUPS, type DemoGroup } from './demoGroups';

export type DemoBeat = {
  readonly label: string;
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
      { label: 'Set up', scene: 'onboarding', params: { step: 'workspace', pick: 'folder' } },
    ],
  },
  {
    ...DEMO_GROUPS.direction,
    hints: DIRECTION_HINTS,
    beats: [{ label: 'Issue session', scene: 'story-direction' }],
  },
  {
    ...DEMO_GROUPS.guide,
    hints: GUIDE_HINTS,
    beats: [{ label: 'Plan', scene: 'story-plan' }],
  },
  {
    ...DEMO_GROUPS.ship,
    hints: SHIP_HINTS,
    beats: [
      { label: 'Review comment', scene: 'story-review' },
      { label: 'Storage', scene: 'demo-storage' },
    ],
  },
];
