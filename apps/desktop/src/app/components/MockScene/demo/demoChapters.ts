import type { DemoHint } from './hints/demoHintTypes';
import { ONBOARDING_HINTS } from './hints/onboardingHints';
import { AGENT_HINTS } from './hints/agentHints';
import { ORCHESTRATE_HINTS } from './hints/orchestrateHints';
import { FIND_HINTS } from './hints/findHints';
import { REVIEW_HINTS } from './hints/reviewHints';
import { setupPlace } from './hints/setupPlace';
import { DEMO_GROUPS, type DemoGroup } from './demoGroups';

export type DemoBeat = {
  readonly label: string;
  readonly shows: string;
  readonly scene: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly place?: string;
};

type PlaceParams = {
  readonly root: Document;
};

export type DemoChapter = DemoGroup & {
  readonly hints?: ReadonlyArray<DemoHint>;
  readonly placeOf?: (params: PlaceParams) => string | null;
  readonly beats: ReadonlyArray<DemoBeat>;
};

export const DEMO_CHAPTERS: readonly [DemoChapter, ...ReadonlyArray<DemoChapter>] = [
  {
    ...DEMO_GROUPS.setup,
    hints: ONBOARDING_HINTS,
    placeOf: setupPlace,
    beats: [
      {
        label: 'Welcome',
        shows: 'Goodboy opens on a welcome screen, ready to find the agents on your Mac.',
        scene: 'onboarding',
        params: { step: 'welcome' },
        place: 'welcome',
      },
      {
        label: 'Agents',
        shows: 'Goodboy lists the agents it found on your Mac and which are ready to use.',
        scene: 'onboarding',
        params: { step: 'agents' },
        place: 'agents',
      },
      {
        label: 'Workspace',
        shows: 'You point Goodboy at your code by choosing a folder.',
        scene: 'onboarding',
        params: { step: 'workspace' },
        place: 'workspace',
      },
      {
        label: 'Tools',
        shows: 'Goodboy connects the tools your agents can use on that code.',
        scene: 'onboarding',
        params: { step: 'tools' },
        place: 'tools',
      },
      {
        label: 'First task',
        shows: 'You hand a first task to an agent and watch it answer.',
        scene: 'onboarding',
        params: { step: 'first-session' },
        place: 'first-session',
      },
    ],
  },
  {
    ...DEMO_GROUPS.agent,
    hints: AGENT_HINTS,
    beats: [
      {
        label: 'Works, then asks',
        shows: 'An agent works on a task, then stops with a question only you can answer.',
        scene: 'chat-shell',
      },
      {
        label: 'Limits',
        shows: 'Claude runs out of its limit and Codex picks the same task up.',
        scene: 'brand-limits',
      },
    ],
  },
  {
    ...DEMO_GROUPS.orchestrate,
    hints: ORCHESTRATE_HINTS,
    beats: [
      {
        label: 'Auto starts',
        shows: 'Auto takes a goal and gets ready to plan it.',
        scene: 'c07-auto-start',
      },
      {
        label: 'Auto plans',
        shows: 'Auto writes a plan and waits for your approval before starting.',
        scene: 'c07-auto-plan',
      },
      {
        label: 'Auto works',
        shows: 'Helper agents run the parts of the plan side by side.',
        scene: 'c07-auto-working',
      },
      {
        label: 'Helper done',
        shows: 'A helper finishes its part and hands the result back to Auto.',
        scene: 'c07-auto-child-done',
      },
      {
        label: 'Run approval',
        shows: 'A saved workflow stops at a step that needs your approval.',
        scene: 'c08-run-approval',
      },
      {
        label: 'Run steps',
        shows: 'The workflow runs its steps, each with its own agent and model.',
        scene: 'c08-run-working',
      },
      {
        label: 'Run done',
        shows: 'The run is finished and ready to be written up as a report.',
        scene: 'c08-run-done',
      },
    ],
  },
  {
    ...DEMO_GROUPS.find,
    hints: FIND_HINTS,
    beats: [
      {
        label: 'Board',
        shows: 'Every session sits on one board, grouped by what needs you.',
        scene: 'board-shell',
      },
      {
        label: 'Library',
        shows: 'Plans and reports from every agent are collected in one library.',
        scene: 'artifacts-lens-shell',
      },
      {
        label: 'Report',
        shows: 'A report sits next to the code it is based on.',
        scene: 'artifact-report',
      },
    ],
  },
  {
    ...DEMO_GROUPS.review,
    hints: REVIEW_HINTS,
    beats: [
      {
        label: 'Diff',
        shows: 'Every change is laid out as a diff to read before it is pushed.',
        scene: 'brand-diff',
      },
      {
        label: 'Comments',
        shows: 'Review comments wait in a queue, each one ready to become a fix.',
        scene: 'resolve-queue-shell',
      },
      {
        label: 'Fixing',
        shows: 'An agent is changing the code to fix a comment.',
        scene: 'resolve-fix-working',
      },
      {
        label: 'Ready',
        shows: 'The fix is ready, with a drafted reply to the reviewer.',
        scene: 'resolve-fix-ready',
      },
    ],
  },
];
