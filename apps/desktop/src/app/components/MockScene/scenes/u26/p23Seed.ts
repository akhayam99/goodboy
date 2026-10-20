import type { AgentRole, Step, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { sceneClock } from '../../sceneClock';
import { WORKSPACE_ID } from '../BoardScene';

const clock = sceneClock({ anchor: '2026-10-19T09:00:00.000Z' });

type StepSeed = {
  readonly role: AgentRole;
  readonly name: string;
  readonly effort: Step['effort'];
  readonly promptPrefix: string;
};

type PresetSeed = {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly steps: ReadonlyArray<StepSeed>;
};

const SCOUT: StepSeed = {
  role: 'scout',
  name: 'Scout the retry path',
  effort: 'medium',
  promptPrefix:
    'Read how payments-api posts a credit to ledger-core and list every place a retry can post it twice.\nName the files and the functions, nothing else.',
};

const PLANNER: StepSeed = {
  role: 'planner',
  name: 'Plan the guard',
  effort: 'high',
  promptPrefix:
    'Using the scout findings, write a plan that makes each credit post idempotent.\nKeep the change inside payments-api.\nList the tests the plan needs.',
};

const IMPLEMENTER: StepSeed = {
  role: 'implementer',
  name: 'Build the guard',
  effort: 'medium',
  promptPrefix: 'Implement the plan on the session branch and commit each part.',
};

const DEBUGGER: StepSeed = {
  role: 'investigator',
  name: 'Reproduce the double credit',
  effort: 'high',
  promptPrefix: 'Reproduce the double credit from a webhook redelivery, then fix the cause.',
};

const TESTER: StepSeed = {
  role: 'tester',
  name: 'Cover the redelivery',
  effort: 'medium',
  promptPrefix: 'Write the tests that fail without the fix and pass with it.',
};

const REVIEWER: StepSeed = {
  role: 'reviewer',
  name: 'Review the diff',
  effort: 'high',
  promptPrefix: 'Review the diff for retries that still post twice. Report findings only.',
};

const DOCS: StepSeed = {
  role: 'docs',
  name: 'Document the key',
  effort: 'low',
  promptPrefix: 'Describe the idempotency key in the payments-api README.',
};

const SEEDS: ReadonlyArray<PresetSeed> = [
  {
    slug: 'fix',
    name: 'Fix and verify',
    description: 'Reproduce the bug, fix it, test it, then review it.',
    steps: [DEBUGGER, TESTER, REVIEWER],
  },
  {
    slug: 'train',
    name: 'Full release train',
    description: 'Scout, plan, build, test, review and document a change.',
    steps: [SCOUT, PLANNER, IMPLEMENTER, TESTER, REVIEWER, DOCS, REVIEWER],
  },
];

type StepsParams = {
  readonly workflowId: WorkflowId;
  readonly seeds: ReadonlyArray<StepSeed>;
};

const stepsOf = ({ workflowId, seeds }: StepsParams): ReadonlyArray<Step> =>
  seeds.map((seed, ordinal) => ({
    id: brandedId<StepId>({ value: `mock-p23-${workflowId}-step-${ordinal}` }),
    workflowId,
    ordinal,
    name: seed.name,
    role: seed.role,
    effort: seed.effort,
    promptPrefix: seed.promptPrefix,
    verbosity: 'normal',
  }));

export const P23_EXTRA_PRESETS: ReadonlyArray<Workflow> = SEEDS.map((seed) => {
  const id = brandedId<WorkflowId>({ value: `mock-p23-preset-${seed.slug}` });
  return {
    id,
    workspaceId: WORKSPACE_ID,
    name: seed.name,
    description: seed.description,
    steps: stepsOf({ workflowId: id, seeds: seed.steps }),
    isPreset: true,
    origin: 'custom',
    createdAt: clock.iso({ at: '2026-10-10T09:00:00.000Z' }),
    updatedAt: clock.iso({ at: '2026-10-10T09:00:00.000Z' }),
  };
});

const BASE_PROMPTS: Readonly<Record<string, string>> = {
  scout: SCOUT.promptPrefix,
  planner: PLANNER.promptPrefix,
  implementer: IMPLEMENTER.promptPrefix,
};

type BaseParams = {
  readonly workflow: Workflow;
};

export const withInstructions = ({ workflow }: BaseParams): Workflow => ({
  ...workflow,
  steps: workflow.steps.map((step) => ({
    ...step,
    promptPrefix: step.role === undefined ? '' : (BASE_PROMPTS[step.role] ?? ''),
  })),
});
