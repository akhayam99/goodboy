export type DemoBeat = {
  readonly label: string;
  readonly scene: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly holdMs: number;
};

export type DemoChapterGroup = 'setup' | 'flows';

export type DemoChapter = {
  readonly id: string;
  readonly group: DemoChapterGroup;
  readonly title: string;
  readonly summary: string;
  readonly tryThis: string;
  readonly beats: ReadonlyArray<DemoBeat>;
};

type DemoGroupCopy = {
  readonly label: string;
  readonly noun: string;
};

export const DEMO_GROUPS = {
  setup: { label: 'Get started', noun: 'Setup' },
  flows: { label: 'Flows', noun: 'Flow' },
} as const satisfies Record<DemoChapterGroup, DemoGroupCopy>;

export const DEMO_CHAPTERS: readonly [DemoChapter, ...ReadonlyArray<DemoChapter>] = [
  {
    id: 'welcome',
    group: 'setup',
    title: 'Welcome',
    summary: 'Goodboy finds the coding agents already on your Mac.',
    tryThis: 'Press Get started and walk the setup yourself.',
    beats: [{ label: 'Welcome', scene: 'onboarding', params: { step: 'welcome' }, holdMs: 5000 }],
  },
  {
    id: 'agents',
    group: 'setup',
    title: 'Your agents',
    summary: 'See which coding agents are ready and sign in to the rest.',
    tryThis: 'Open the API key option to see the other providers.',
    beats: [
      { label: 'Agents', scene: 'onboarding', params: { step: 'agents' }, holdMs: 5000 },
      {
        label: 'Sign in',
        scene: 'onboarding',
        params: { step: 'agents', agents: 'signin' },
        holdMs: 4500,
      },
    ],
  },
  {
    id: 'workspace',
    group: 'setup',
    title: 'Workspace and tools',
    summary: 'Point Goodboy at your repositories, then link GitHub or Linear.',
    tryThis: 'Move between the steps with Back and Continue.',
    beats: [
      { label: 'Workspace', scene: 'onboarding', params: { step: 'workspace' }, holdMs: 5000 },
      { label: 'Tools', scene: 'onboarding', params: { step: 'tools' }, holdMs: 5000 },
    ],
  },
  {
    id: 'first-session',
    group: 'setup',
    title: 'First session',
    summary: 'Ask a question or hand over a task to start your first session.',
    tryThis: 'Type your own task in the box.',
    beats: [
      {
        label: 'First session',
        scene: 'onboarding',
        params: { step: 'first-session' },
        holdMs: 6000,
      },
    ],
  },
  {
    id: 'agent',
    group: 'flows',
    title: 'Work with an agent',
    summary: 'The Implementer edits, explains and stops to ask when a choice is yours.',
    tryThis: 'Press Answer it yourself on the blocking question.',
    beats: [{ label: 'Session', scene: 'chat-shell', holdMs: 7000 }],
  },
  {
    id: 'run',
    group: 'flows',
    title: 'Run a workflow',
    summary: 'A run chains agents step by step and stops when a step needs you.',
    tryThis: 'Open a step to read what that agent did.',
    beats: [
      { label: 'Ready', scene: 'c08-run-ready', holdMs: 4000 },
      { label: 'Working', scene: 'c08-run-working', holdMs: 5000 },
      { label: 'Approval', scene: 'c08-run-approval', holdMs: 5000 },
      { label: 'Done', scene: 'c08-run-done', holdMs: 5000 },
    ],
  },
  {
    id: 'auto',
    group: 'flows',
    title: 'Auto',
    summary: 'Auto plans the work, delegates each piece and reports back.',
    tryThis: 'Read the plan, then follow a child agent.',
    beats: [
      { label: 'Start', scene: 'c07-auto-start', holdMs: 4000 },
      { label: 'Plan', scene: 'c07-auto-plan', holdMs: 5000 },
      { label: 'Working', scene: 'c07-auto-working', holdMs: 5000 },
      { label: 'Child done', scene: 'c07-auto-child-done', holdMs: 5000 },
    ],
  },
  {
    id: 'board',
    group: 'flows',
    title: 'Board',
    summary: 'Every session in one place, grouped by what needs you.',
    tryThis: 'Scan the columns, then open a card.',
    beats: [{ label: 'Board', scene: 'board-shell', holdMs: 6000 }],
  },
  {
    id: 'limits',
    group: 'flows',
    title: 'Limits in sight',
    summary: 'See how much of each plan is left before a run stops.',
    tryThis: 'Hover the Claude chip in the top bar to see when the plan resets.',
    beats: [{ label: 'Limits', scene: 'brand-limits', holdMs: 6000 }],
  },
  {
    id: 'review',
    group: 'flows',
    title: 'Review the diff',
    summary: 'Read every change before anything is pushed.',
    tryThis: 'Switch between files and leave a note on a line.',
    beats: [{ label: 'Diff', scene: 'brand-diff', holdMs: 6000 }],
  },
  {
    id: 'resolve',
    group: 'flows',
    title: 'Resolve review comments',
    summary: 'Pull request comments become fixes, and replies go back to the thread.',
    tryThis: 'Pick a comment and start a fix.',
    beats: [
      { label: 'Queue', scene: 'resolve-queue-shell', holdMs: 5000 },
      { label: 'Fixing', scene: 'resolve-fix-working', holdMs: 5000 },
      { label: 'Ready', scene: 'resolve-fix-ready', holdMs: 5000 },
    ],
  },
  {
    id: 'artifacts',
    group: 'flows',
    title: 'Artifacts',
    summary: 'Plans, reports and wireframes stay next to the code they describe.',
    tryThis: 'Open a report from the library.',
    beats: [
      { label: 'Library', scene: 'artifacts-lens-shell', holdMs: 5000 },
      { label: 'Report', scene: 'artifact-report', holdMs: 5000 },
    ],
  },
];
