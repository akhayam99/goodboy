import { WORKFLOW_LIBRARY, normalizeAgentRole } from '@goodboy/core';
import type { WorkflowRunHistoryRow } from '@goodboy/db';
import type {
  AgentRole,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { brandedId } from '../../../../../../features/history/testing/brandedId';
import { sceneClock } from '../../../sceneClock';
import { OVERRIDES } from '../../flow-audit/fixtures';

const clock = sceneClock({ anchor: '2026-10-15T15:12:00.000Z' });

const NOW = clock.iso({ at: '2026-10-15T15:12:00.000Z' });

export const C13_WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'mock-c13-workspace-harborline' });

export const C13_WORKSPACE: Workspace = {
  id: C13_WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

type StepSeed = {
  readonly role: AgentRole;
  readonly name: string;
  readonly promptPrefix?: string;
  readonly expectedOutput?: string;
};

type WorkflowParams = {
  readonly id: string;
  readonly name: string;
  readonly origin: Workflow['origin'];
  readonly steps: ReadonlyArray<StepSeed>;
};

const workflowOf = ({ id, name, origin, steps }: WorkflowParams): Workflow => {
  const workflowId = brandedId<WorkflowId>({ value: id });
  return {
    id: workflowId,
    workspaceId: C13_WORKSPACE_ID,
    name,
    description: '',
    origin,
    isPreset: true,
    steps: steps.map((step, ordinal): Step => ({
      id: brandedId<StepId>({ value: `${id}-step-${ordinal}` }),
      workflowId,
      role: step.role,
      ordinal,
      name: step.name,
      promptPrefix: step.promptPrefix ?? '',
      ...(step.expectedOutput === undefined ? {} : { expectedOutput: step.expectedOutput }),
    })),
    createdAt: NOW,
    updatedAt: NOW,
  };
};

type LibraryParams = {
  readonly slug: string;
  readonly renameFirstStep?: string;
};

const libraryWorkflow = ({ slug, renameFirstStep }: LibraryParams): Workflow | null => {
  const entry = WORKFLOW_LIBRARY.find((candidate) => candidate.slug === slug);
  if (entry === undefined) {
    return null;
  }
  return workflowOf({
    id: `wf_seed_${entry.slug}_${C13_WORKSPACE_ID}`,
    name: entry.name,
    origin: 'library',
    steps: entry.steps.map((step, ordinal) => ({
      role: normalizeAgentRole({ role: step.role }),
      name: ordinal === 0 && renameFirstStep !== undefined ? renameFirstStep : step.name,
      promptPrefix: step.promptPrefix,
      expectedOutput: step.expectedOutput,
    })),
  });
};

const FLAKY = workflowOf({
  id: 'mock-c13-workflow-fix-flaky-tests',
  name: 'Fix flaky tests',
  origin: 'custom',
  steps: [
    { role: 'scout', name: 'Find the flaky tests' },
    { role: 'implementer', name: 'Make the export tests deterministic' },
    { role: 'reviewer', name: 'Check the fix' },
  ],
});

const LINT = workflowOf({
  id: 'mock-c13-workflow-lint-and-type-check',
  name: 'Lint and type check',
  origin: 'custom',
  steps: [
    { role: 'tester', name: 'Run lint and types' },
    { role: 'implementer', name: 'Fix what fails' },
  ],
});

export const FIX_A_BUG = libraryWorkflow({ slug: 'fix-a-bug' });

const REFACTOR = libraryWorkflow({
  slug: 'refactor-example',
  renameFirstStep: 'Scout payments-api',
});

export const C13_WORKFLOWS: ReadonlyArray<Workflow> = [FLAKY, FIX_A_BUG, REFACTOR, LINT].filter(
  (workflow): workflow is Workflow => workflow !== null,
);

type RunParams = {
  readonly id: string;
  readonly workflow: Workflow | null;
  readonly goal: string;
  readonly at: string;
  readonly started: number;
  readonly finished: number;
  readonly running?: number;
  readonly failed?: number;
  readonly costUsd: number;
};

const runOf = ({
  id,
  workflow,
  goal,
  at,
  started,
  finished,
  running = 0,
  failed = 0,
  costUsd,
}: RunParams): WorkflowRunHistoryRow | null =>
  workflow === null
    ? null
    : {
        workflowRunId: brandedId<WorkflowRunId>({ value: `mock-c13-run-${id}` }),
        workflowId: workflow.id,
        sessionId: brandedId<SessionId>({ value: `mock-c13-session-${id}` }),
        sessionGoal: goal,
        isSessionArchived: false,
        executionMode: 'static',
        orchestrationOutcome: null,
        createdAt: clock.iso({ at }),
        stepCount: workflow.steps.length,
        startedSteps: started,
        finishedSteps: finished,
        runningSteps: running,
        failedSteps: failed,
        stoppedSteps: 0,
        costUsd,
      };

const BUG_SESSIONS = [
  'Retry policy for 429s on payments-api',
  'Fix the rounding drift in payouts',
  'Cascadia tenant limits',
  'Northwind webhook retries',
  'Draft the payout delay notice',
  'Acme refund idempotency',
  'Nightly reconciliation before cutoff',
  'Statement export backfill',
  'Old export prototype',
  'Ledger export speed up',
  'Harborline ledger-core cleanup',
  'notify-relay timeout tuning',
];

const bugRuns = (): ReadonlyArray<WorkflowRunHistoryRow | null> =>
  BUG_SESSIONS.map((goal, index) => {
    const steps = FIX_A_BUG?.steps.length ?? 0;
    const isRunning = index === 0;
    const isFailed = index === 3 || index === 7;
    return runOf({
      id: `bug-${index}`,
      workflow: FIX_A_BUG,
      goal,
      at: new Date(Date.parse('2026-10-15T14:40:00.000Z') - index * 9 * 3_600_000).toISOString(),
      started: isRunning || isFailed ? Math.max(1, steps - 1) : steps,
      finished: isRunning || isFailed ? Math.max(0, steps - 2) : steps,
      running: isRunning ? 1 : 0,
      failed: isFailed ? 1 : 0,
      costUsd: 0.18 + index * 0.07,
    });
  });

export const C13_HISTORY: ReadonlyArray<WorkflowRunHistoryRow> = [
  runOf({
    id: 'flaky-ledger',
    workflow: FLAKY,
    goal: 'Ledger export speed up',
    at: '2026-10-15T15:08:00.000Z',
    started: 3,
    finished: 2,
    running: 1,
    costUsd: 0.71,
  }),
  runOf({
    id: 'refactor-ledger',
    workflow: REFACTOR,
    goal: 'Ledger export speed up',
    at: '2026-10-15T14:12:00.000Z',
    started: 4,
    finished: 4,
    costUsd: 0.92,
  }),
  runOf({
    id: 'flaky-nightly',
    workflow: FLAKY,
    goal: 'Nightly reconciliation before cutoff',
    at: '2026-10-14T15:00:00.000Z',
    started: 3,
    finished: 3,
    costUsd: 0.48,
  }),
  runOf({
    id: 'flaky-acme',
    workflow: FLAKY,
    goal: 'Acme refund idempotency',
    at: '2026-10-10T15:00:00.000Z',
    started: 2,
    finished: 1,
    failed: 1,
    costUsd: 0.21,
  }),
  runOf({
    id: 'refactor-cascadia',
    workflow: REFACTOR,
    goal: 'Cascadia tenant limits',
    at: '2026-10-09T10:00:00.000Z',
    started: 4,
    finished: 4,
    costUsd: 1.04,
  }),
  ...bugRuns(),
]
  .filter((run): run is WorkflowRunHistoryRow => run !== null)
  .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
