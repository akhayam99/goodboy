import type { DemoHint } from './hints/demoHintTypes';
import { ONBOARDING_HINTS } from './hints/onboardingHints';
import { AGENT_HINTS } from './hints/agentHints';
import { ORCHESTRATE_HINTS } from './hints/orchestrateHints';
import { FIND_HINTS } from './hints/findHints';
import { REVIEW_HINTS } from './hints/reviewHints';
import { DEMO_GROUPS, type DemoGroup } from './demoGroups';
import type { StageSize } from './stageFitOf';

export type DemoBeat = {
  readonly label: string;
  readonly scene: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly size?: StageSize;
};

const WIZARD_SIZE: StageSize = { minWidth: 880, minHeight: 580, maxScale: 1.5 };

export type DemoChapter = DemoGroup & {
  readonly hints: ReadonlyArray<DemoHint>;
  readonly beats: ReadonlyArray<DemoBeat>;
};

export const DEMO_CHAPTERS: readonly [DemoChapter, ...ReadonlyArray<DemoChapter>] = [
  {
    ...DEMO_GROUPS.setup,
    hints: ONBOARDING_HINTS,
    beats: [
      { label: 'Set up', scene: 'onboarding', params: { step: 'welcome' }, size: WIZARD_SIZE },
    ],
  },
  {
    ...DEMO_GROUPS.agent,
    hints: AGENT_HINTS,
    beats: [{ label: 'Agent session', scene: 'chat-shell' }],
  },
  {
    ...DEMO_GROUPS.orchestrate,
    hints: ORCHESTRATE_HINTS,
    beats: [{ label: 'Auto run', scene: 'c07-auto-start' }],
  },
  {
    ...DEMO_GROUPS.find,
    hints: FIND_HINTS,
    beats: [
      { label: 'Board', scene: 'board-shell' },
      { label: 'Library', scene: 'artifacts-lens-shell' },
      { label: 'Report', scene: 'artifact-report' },
    ],
  },
  {
    ...DEMO_GROUPS.review,
    hints: REVIEW_HINTS,
    beats: [
      { label: 'Diff', scene: 'brand-diff' },
      { label: 'Review comments', scene: 'resolve-queue-shell' },
    ],
  },
];
