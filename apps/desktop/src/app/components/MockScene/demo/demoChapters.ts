import type { DemoHint } from './hints/demoHintTypes';
import { ONBOARDING_HINTS } from './hints/onboardingHints';
import { AGENT_HINTS } from './hints/agentHints';
import { setupPlace } from './hints/setupPlace';
import { DEMO_GROUPS, type DemoGroup } from './demoGroups';

export type DemoBeat = {
  readonly label: string;
  readonly scene: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly place?: string;
};

type PlaceParams = {
  readonly root: Document;
};

export type DemoChapter = DemoGroup & {
  readonly summary: string;
  readonly tryThis: string;
  readonly hints?: ReadonlyArray<DemoHint>;
  readonly placeOf?: (params: PlaceParams) => string | null;
  readonly beats: ReadonlyArray<DemoBeat>;
};

export const DEMO_CHAPTERS: readonly [DemoChapter, ...ReadonlyArray<DemoChapter>] = [
  {
    ...DEMO_GROUPS.setup,
    summary:
      'Goodboy finds the agents on your Mac, then you point it at your code and hand over a first task.',
    tryThis: 'Press Get started and walk the setup yourself.',
    hints: ONBOARDING_HINTS,
    placeOf: setupPlace,
    beats: [
      { label: 'Welcome', scene: 'onboarding', params: { step: 'welcome' }, place: 'welcome' },
      { label: 'Agents', scene: 'onboarding', params: { step: 'agents' }, place: 'agents' },
      {
        label: 'Workspace',
        scene: 'onboarding',
        params: { step: 'workspace' },
        place: 'workspace',
      },
      { label: 'Tools', scene: 'onboarding', params: { step: 'tools' }, place: 'tools' },
      {
        label: 'First task',
        scene: 'onboarding',
        params: { step: 'first-session' },
        place: 'first-session',
      },
    ],
  },
  {
    ...DEMO_GROUPS.agent,
    summary:
      'Send a follow-up, answer the question the agent stops on and keep an eye on your limits.',
    tryThis: 'Send the message, then answer the blocking question.',
    hints: AGENT_HINTS,
    beats: [
      { label: 'Works, then asks', scene: 'chat-shell' },
      { label: 'Limits', scene: 'brand-limits' },
    ],
  },
  {
    ...DEMO_GROUPS.orchestrate,
    summary:
      'Let Auto plan and delegate, or run a saved workflow that stops when a step needs you.',
    tryThis: 'Read the plan, then follow a helper agent.',
    beats: [
      { label: 'Auto starts', scene: 'c07-auto-start' },
      { label: 'Auto plans', scene: 'c07-auto-plan' },
      { label: 'Auto works', scene: 'c07-auto-working' },
      { label: 'Helper done', scene: 'c07-auto-child-done' },
      { label: 'Run approval', scene: 'c08-run-approval' },
      { label: 'Run steps', scene: 'c08-run-working' },
      { label: 'Run done', scene: 'c08-run-done' },
    ],
  },
  {
    ...DEMO_GROUPS.find,
    summary:
      'Every session on one board, grouped by what needs you, and every report next to its code.',
    tryThis: 'Open the card that needs you, then a report from the library.',
    beats: [
      { label: 'Board', scene: 'board-shell' },
      { label: 'Library', scene: 'artifacts-lens-shell' },
      { label: 'Report', scene: 'artifact-report' },
    ],
  },
  {
    ...DEMO_GROUPS.review,
    summary: 'Read every change before it is pushed, and turn review comments into fixes.',
    tryThis: 'Switch between files, then pick a comment and start a fix.',
    beats: [
      { label: 'Diff', scene: 'brand-diff' },
      { label: 'Comments', scene: 'resolve-queue-shell' },
      { label: 'Fixing', scene: 'resolve-fix-working' },
      { label: 'Ready', scene: 'resolve-fix-ready' },
    ],
  },
];
