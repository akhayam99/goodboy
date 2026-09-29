export type MockProvider = 'anthropic' | 'codex';

export type ChipKind = 'run' | 'done' | 'queued' | 'need' | 'limit';

export type BoardStage = 'building' | 'running' | 'needs' | 'review';

export type BoardMove = 'leave' | 'arrive';

export type BoardCardData = {
  readonly title: string;
  readonly repo: string;
  readonly fact: string;
  readonly cents: number;
  readonly isNeed?: boolean;
  readonly move?: BoardMove;
};

export type BoardColumnData = {
  readonly stage: BoardStage;
  readonly name: string;
  readonly cards: readonly BoardCardData[];
};

export type RunRowData = {
  readonly role: string;
  readonly step: string;
  readonly provider: MockProvider;
  readonly model: string;
  readonly cents: number;
};

export type ActivityRowData = {
  readonly provider: MockProvider;
  readonly role: string;
  readonly what: string;
  readonly model: string;
  readonly state: ChipKind;
  readonly isAsk?: boolean;
};

export type DecisionData = {
  readonly id: string;
  readonly title: string;
  readonly reason: string;
  readonly isMinor?: boolean;
};

export type HandoffAgentData = {
  readonly provider: MockProvider;
  readonly role: string;
  readonly what: string;
  readonly model: string;
};

export type BriefChipData = {
  readonly label: string;
  readonly count?: number;
};

export type ContextBlock = 'goal' | 'dec' | 'sum';

export type QuestionData = {
  readonly label: string;
  readonly text: string;
  readonly answers: readonly string[];
  readonly action: string;
};

export type ContextData = {
  readonly title: string;
  readonly tabs: Readonly<Record<ContextBlock, string>>;
  readonly goal: string;
  readonly decisionCount: number;
};

const PROVIDER_NAME = {
  anthropic: 'Claude',
  codex: 'Codex',
} satisfies Record<MockProvider, string>;

const CHIP_LABEL = {
  run: 'Running',
  done: 'Done',
  queued: 'Queued',
  need: 'Needs you',
  limit: 'Limit reached',
} satisfies Record<ChipKind, string>;

const BOARD_TITLE = 'Harborline';

const BOARD_COLUMNS: readonly BoardColumnData[] = [
  {
    stage: 'building',
    name: 'Building',
    cards: [
      {
        title: 'Add a refund reason to the payout report',
        repo: 'ledger-core',
        fact: 'planning',
        cents: 12,
      },
      {
        title: 'Retry failed Slack alerts with backoff',
        repo: 'notify-relay',
        fact: 'scouting',
        cents: 4,
      },
    ],
  },
  {
    stage: 'running',
    name: 'Running',
    cards: [
      {
        title: 'Speed up the payout export for large merchants',
        repo: 'ledger-core',
        fact: '3 agents',
        cents: 88,
      },
      {
        title: 'Warn merchants before a payout hold',
        repo: 'notify-relay',
        fact: '2 agents',
        cents: 31,
        move: 'leave',
      },
      {
        title: 'Show webhook retries in the admin log',
        repo: 'payments-api',
        fact: '1 agent',
        cents: 19,
      },
    ],
  },
  {
    stage: 'needs',
    name: 'Needs you',
    cards: [
      {
        title: 'Warn merchants before a payout hold',
        repo: 'notify-relay',
        fact: '1 question',
        cents: 31,
        isNeed: true,
        move: 'arrive',
      },
      {
        title: 'Fix the rounding drift in the settlement export',
        repo: 'ledger-core',
        fact: '1 question',
        cents: 58,
        isNeed: true,
      },
    ],
  },
  {
    stage: 'review',
    name: 'In review',
    cards: [
      {
        title: 'Stop retried webhooks posting a second credit',
        repo: 'payments-api',
        fact: 'PR #318',
        cents: 307,
      },
      {
        title: 'Move the fee table to the new schema',
        repo: 'ledger-core',
        fact: 'PR #122',
        cents: 112,
      },
    ],
  },
];

const BOARD_HEAD = {
  needBefore: '1 needs you',
  needAfter: '2 need you',
  runBefore: '3 running',
  runAfter: '2 running',
} satisfies Record<string, string>;

const BOARD_DELAYS: readonly number[] = [700, 950];

const BOARD_LABEL =
  'Example board: four columns of Harborline tasks, one moving from Running to Needs you.';

const TASK_TITLE = 'Duplicate credit fix';

const TASK_REPO = 'payments-api';

const RUN_SIDE = 'Example run';

const RUN_ROWS: readonly RunRowData[] = [
  {
    role: 'Scout ×4',
    step: 'Read the webhook handler and the retry notices',
    provider: 'anthropic',
    model: 'Haiku 4.5',
    cents: 13,
  },
  {
    role: 'Planner',
    step: 'Agree where the dedupe belongs',
    provider: 'anthropic',
    model: 'Opus 5.5 High',
    cents: 128,
  },
  {
    role: 'Implementer',
    step: 'Dedupe on the event id',
    provider: 'codex',
    model: 'GPT-5.6 Sol',
    cents: 94,
  },
  {
    role: 'Tester',
    step: 'Replay one event three times',
    provider: 'anthropic',
    model: 'Haiku 4.5',
    cents: 21,
  },
  {
    role: 'Reviewer',
    step: 'Read the diff before the pull request',
    provider: 'codex',
    model: 'GPT-5.6 Terra',
    cents: 29,
  },
  {
    role: 'Resolver',
    step: 'Answer the review comments',
    provider: 'anthropic',
    model: 'Sonnet 5',
    cents: 22,
  },
];

const RUN_HEAVY_CENTS = 980;

const RUN_START_DONE = 2;

const RUN_DELAYS: readonly number[] = [700, 1400, 2100, 2800];

const RUN_TOTAL_LABEL = 'This run';

const RUN_NOW_LABEL = 'Now';

const RUN_HEAVY_LABEL = 'The same six steps on one heavy model:';

const RUN_LABEL =
  'Example run: six steps of a duplicate credit fix, each on its own model, costing far less than one heavy model.';

const ACTIVITY_ROWS: readonly ActivityRowData[] = [
  {
    provider: 'anthropic',
    role: 'Planner',
    what: 'Plan the refund path',
    model: 'Opus 5.5',
    state: 'done',
  },
  {
    provider: 'codex',
    role: 'Implementer',
    what: 'Dedupe on the event id',
    model: 'GPT-5.6 Sol',
    state: 'run',
    isAsk: true,
  },
  {
    provider: 'anthropic',
    role: 'Tester',
    what: 'Replay one event three times',
    model: 'Haiku 4.5',
    state: 'run',
  },
  {
    provider: 'anthropic',
    role: 'Docs',
    what: 'Note the retry rule in the runbook',
    model: 'Sonnet 5',
    state: 'queued',
  },
];

const ACTIVITY_HEAD = {
  need: '1 needs you',
  run: '2 running',
} satisfies Record<string, string>;

const QUESTION: QuestionData = {
  label: 'Question',
  text: 'A retried webhook already credited the merchant twice. Refund the second credit, or keep it and tell the merchant?',
  answers: ['Refund the second credit', 'Keep it and notify'],
  action: 'Answer',
};

const ACTIVITY_DELAYS: readonly number[] = [800];

const ACTIVITY_LABEL =
  'Example activity: four agents on a duplicate credit fix, the Implementer stopping to ask you a question.';

const HANDOFF_CONTEXT: ContextData = {
  title: 'Context',
  tabs: { goal: 'Goal', dec: 'Decisions', sum: 'Summary' },
  goal: 'Goal: a retried webhook never posts a second credit',
  decisionCount: 2,
};

const HANDOFF_DECISIONS: readonly DecisionData[] = [
  {
    id: 'D3',
    title: 'Dedupe on the event id inside the transaction',
    reason: 'Replaces D1. A retry that lands mid-transaction slips past a check in the handler.',
  },
  {
    id: 'D2',
    title: 'Keep the processor event id on every credit row',
    reason: 'From the plan, turn 1.',
    isMinor: true,
  },
];

const HANDOFF_FROM: HandoffAgentData = {
  provider: 'anthropic',
  role: 'Implementer',
  what: 'Dedupe on the event id',
  model: 'Opus 5.5',
};

const HANDOFF_TO: HandoffAgentData = {
  provider: 'codex',
  role: 'Implementer',
  what: 'Dedupe on the event id',
  model: 'GPT-5.6 Sol',
};

const HANDOFF_NOTE = 'Claude hit its usage limit. The turn moved to Codex.';

const HANDOFF_BRIEF = 'Starts from the same brief';

const HANDOFF_BRIEF_CHIPS: readonly BriefChipData[] = [
  { label: 'Goal' },
  { label: 'Plan' },
  { label: 'Decisions', count: 2 },
  { label: 'Summary' },
];

const HANDOFF_DELAYS: readonly number[] = [
  800, 1300, 1800, 2150, 2270, 2390, 2510, 2700, 2940, 3060,
];

const HANDOFF_LABEL =
  'Example handoff: Claude hits its usage limit and Codex picks up the same task from the same goal, decisions and summary.';

export const HARBORLINE = {
  PROVIDER_NAME,
  CHIP_LABEL,
  BOARD_TITLE,
  BOARD_COLUMNS,
  BOARD_HEAD,
  BOARD_DELAYS,
  BOARD_LABEL,
  TASK_TITLE,
  TASK_REPO,
  RUN_SIDE,
  RUN_ROWS,
  RUN_HEAVY_CENTS,
  RUN_START_DONE,
  RUN_DELAYS,
  RUN_TOTAL_LABEL,
  RUN_NOW_LABEL,
  RUN_HEAVY_LABEL,
  RUN_LABEL,
  ACTIVITY_ROWS,
  ACTIVITY_HEAD,
  QUESTION,
  ACTIVITY_DELAYS,
  ACTIVITY_LABEL,
  HANDOFF_CONTEXT,
  HANDOFF_DECISIONS,
  HANDOFF_FROM,
  HANDOFF_TO,
  HANDOFF_NOTE,
  HANDOFF_BRIEF,
  HANDOFF_BRIEF_CHIPS,
  HANDOFF_DELAYS,
  HANDOFF_LABEL,
} as const;
