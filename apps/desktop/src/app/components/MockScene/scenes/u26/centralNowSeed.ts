import { brandId, type Agent, type AgentId, type MountId } from '@goodboy/types';
import {
  aDelegation,
  aView,
  FIXTURE_ROOT,
} from '../../../../../features/auto/testing/autoViewFixtures';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import {
  branchFactsOf,
  type BranchFacts,
  type BranchStatusFacts,
} from '../../../../../features/session/central/branches/branchFactsOf';
import {
  aMountRow,
  aRequest,
} from '../../../../../features/session/central/branches/testing/aMountRow';
import type { ActionCardModel } from '../../../../../features/session/central/next/actionCardsOf';
import {
  aQuestionCard,
  anAutoCard,
} from '../../../../../features/session/central/now/testing/nowCards';
import {
  aNowAgent,
  aNowRun,
  aNowStepAgent,
  aNowWorkflow,
  NOW_CLOCK,
  NOW_MOUNT_API,
  NOW_MOUNT_LEDGER,
  nowModelOf,
} from '../../../../../features/session/central/now/testing/nowModelOf';
import type { SessionWorkModel } from '../../../../../features/session/central/useSessionWorkModel';
import type { WorkflowAdvanceState } from '../../../../../features/workflows/advanceGate';
import type { WorkTimeSource } from '../../../../../features/workTreeModel/workTimeSource';
import { centralStorySeedOf } from './centralStorySeed';

export type CentralNowVariant =
  | 'run'
  | 'orchestrated'
  | 'auto'
  | 'agent'
  | 'branches'
  | 'stale'
  | 'story'
  | 'story-many'
  | 'story-skipped'
  | 'story-one-project'
  | 'finished';

export type CentralNowSeed = Readonly<{
  model: SessionWorkModel;
  agents: ReadonlyArray<Agent>;
  cards: ReadonlyArray<ActionCardModel>;
  facts: ReadonlyArray<BranchFacts>;
  branchCards: ReadonlyArray<ActionCardModel>;
  doneOutcome: string | null;
  source: WorkTimeSource;
}>;

type SeedParams = {
  readonly variant: CentralNowVariant;
};

const MINUTE_MS = 60_000;
const TWELVE_MINUTES_AGO = NOW_CLOCK - 12 * MINUTE_MS;

const API_BRANCH = 'ak/eng-1190-tenant-limits';
const LEDGER_BRANCH = 'ak/eng-1190-ledger-limits';
const BUILD_STEPS = ['Scope', 'Tests', 'Implement', 'Review', 'Docs', 'Ship'];

type SourceParams = {
  readonly liveIds: ReadonlyArray<AgentId>;
};

const sourceOf = ({ liveIds }: SourceParams): WorkTimeSource => ({
  nowMs: NOW_CLOCK,
  spans: [],
  history: null,
  liveStartMs: new Map(liveIds.map((id) => [id, TWELVE_MINUTES_AGO])),
  childrenOf: new Map(),
});

type BuildRunParams = {
  readonly mountId: MountId;
};

const buildRunSeed = ({ mountId }: BuildRunParams) => {
  const attached = aNowRun({
    key: 'build',
    title: 'Build',
    workflow: aNowWorkflow({ key: 'build', name: 'Build', stepNames: BUILD_STEPS }),
  });
  const agents = [
    aNowStepAgent({ attached, stepIndex: 0, status: 'completed', name: 'Scope', mountId }),
    aNowStepAgent({ attached, stepIndex: 1, status: 'completed', name: 'Tests', mountId }),
    aNowStepAgent({
      attached,
      stepIndex: 2,
      status: 'running',
      name: 'Adding the limit check to payout creation',
      kind: 'implementer',
      mountId,
    }),
  ];
  const waitingStep = attached.workflow.steps[3];
  if (waitingStep === undefined) {
    throw new Error('The Build workflow needs a fourth step.');
  }
  const advance: WorkflowAdvanceState = {
    kind: 'blocked',
    reason: 'questions',
    step: waitingStep,
    failedStep: null,
  };
  return { attached, agents, advance };
};

const mountRowsOf = ({ variant }: SeedParams) => {
  const api = aMountRow({
    key: 'payments-api',
    projectName: 'payments-api',
    branch: API_BRANCH,
    request:
      variant === 'finished'
        ? aRequest({ provider: 'github', number: 309, checks: 'success' })
        : aRequest({
            provider: 'github',
            number: 309,
            state: 'draft',
            isDraft: true,
            checks: 'failure',
          }),
  });
  const ledger = aMountRow({
    key: 'ledger-core',
    projectName: 'ledger-core',
    branch: LEDGER_BRANCH,
    request: aRequest({ provider: 'gitlab', number: 42, checks: 'success' }),
  });
  return variant === 'branches'
    ? [
        { ...api, mountId: NOW_MOUNT_API },
        { ...ledger, mountId: NOW_MOUNT_LEDGER },
      ]
    : [{ ...api, mountId: NOW_MOUNT_API }];
};

const factsOf = ({ variant }: SeedParams): ReadonlyArray<BranchFacts> => {
  const rows = mountRowsOf({ variant });
  const fresh = new Date(NOW_CLOCK - 2 * MINUTE_MS).toISOString();
  const stale = new Date(NOW_CLOCK - 12 * MINUTE_MS).toISOString();
  return branchFactsOf({
    rows,
    fetchedAtByMountId: new Map(
      rows.map((row) => [row.mountId, variant === 'stale' ? stale : fresh]),
    ),
    behindByMountId: new Map([[NOW_MOUNT_API, 6]]),
    liveCountByMountId: new Map([
      [NOW_MOUNT_API, 1],
      [NOW_MOUNT_LEDGER, 1],
    ]),
    liveTitleByMountId: new Map([
      [NOW_MOUNT_API, 'Implementer'],
      [NOW_MOUNT_LEDGER, 'Implementer'],
    ]),
    statusByMountId: new Map<string, BranchStatusFacts>(
      rows.map((row) => [
        row.mountId,
        { ahead: 4, push: { kind: 'in-sync' }, changedFiles: 0, isRebasing: false },
      ]),
    ),
    now: NOW_CLOCK,
  });
};

const autoSeed = (): Pick<CentralNowSeed, 'model' | 'agents' | 'cards' | 'source'> => {
  const root = aNowAgent({
    key: 'auto',
    kind: 'auto',
    name: 'Check the payout docs against the new limits',
    status: 'running',
  });
  const fixerId = brandId<AgentId>({ value: 'agent-fixer' });
  const view: AutoTreeView = aView({
    phase: 'waiting',
    delegations: [
      {
        ...aDelegation({ key: 'fixer', role: 'implementer', state: 'accepted' }),
        childAgentId: fixerId,
        request: { title: 'Fix the ledger-core retry', task: 'Fix the ledger-core retry.' },
        createdAt: NOW_CLOCK - 2 * MINUTE_MS,
      },
    ],
  });
  const agents = [root];
  return {
    model: nowModelOf({ agents, autoTrees: [view] }),
    agents,
    cards: [
      anAutoCard({
        target: {
          agentId: fixerId,
          rootAgentId: FIXTURE_ROOT,
          role: 'Fix the ledger-core retry',
          kind: 'neverStarted',
          reason: 'Auto created it, no first message reached it.',
          canRetry: true,
        },
      }),
    ],
    source: sourceOf({ liveIds: [] }),
  };
};

const orchestratedSeed = (): Pick<CentralNowSeed, 'model' | 'agents' | 'cards' | 'source'> => {
  const attached = aNowRun({
    key: 'orch',
    title: 'Payout limits',
    isDynamic: true,
    workflow: aNowWorkflow({
      key: 'orch',
      name: 'Orchestrated',
      stepNames: ['Map the payout code', 'Write the limit plan', 'Build the limit table'],
      origin: 'orchestrated',
    }),
  });
  const agents = [
    aNowStepAgent({ attached, stepIndex: 0, status: 'completed', name: 'Map the payout code' }),
    aNowStepAgent({ attached, stepIndex: 1, status: 'completed', name: 'Write the limit plan' }),
    aNowStepAgent({ attached, stepIndex: 2, status: 'completed', name: 'Build the limit table' }),
  ];
  return {
    model: nowModelOf({
      agents,
      runs: [attached],
      decidingRunIds: new Set([attached.run.id]),
    }),
    agents,
    cards: [],
    source: sourceOf({ liveIds: [] }),
  };
};

const agentSeed = (): Pick<CentralNowSeed, 'model' | 'agents' | 'cards' | 'source'> => {
  const agent = {
    ...aNowAgent({
      key: 'implementer',
      name: 'Add the limit table',
      status: 'running',
      kind: 'implementer',
      mountId: NOW_MOUNT_LEDGER,
    }),
    providerOverride: 'anthropic' as const,
    modelOverride: 'claude-opus-5-5',
    effort: 'high' as const,
  };
  return {
    model: nowModelOf({ agents: [agent] }),
    agents: [agent],
    cards: [],
    source: sourceOf({ liveIds: [agent.id] }),
  };
};

const finishedSeed = (): Pick<CentralNowSeed, 'model' | 'agents' | 'cards' | 'source'> => ({
  model: nowModelOf({ agents: [] }),
  agents: [],
  cards: [],
  source: sourceOf({ liveIds: [] }),
});

const runSeed = ({
  variant,
}: SeedParams): Pick<CentralNowSeed, 'model' | 'agents' | 'cards' | 'source'> => {
  const { attached, agents, advance } = buildRunSeed({ mountId: NOW_MOUNT_API });
  const extra =
    variant === 'branches'
      ? [
          {
            ...aNowAgent({
              key: 'implementer',
              name: 'Add the limit table',
              status: 'running',
              kind: 'implementer',
              mountId: NOW_MOUNT_LEDGER,
            }),
          },
        ]
      : [];
  const all = [...agents, ...extra];
  return {
    model: nowModelOf({
      agents: all,
      runs: [attached],
      advanceByRunId: new Map([[attached.run.id, advance]]),
    }),
    agents: all,
    cards: [aQuestionCard({ where: 'Build step 4' })],
    source: sourceOf({
      liveIds: all.filter((agent) => agent.status === 'running').map((agent) => agent.id),
    }),
  };
};

const BY_VARIANT: Record<
  CentralNowVariant,
  (params: SeedParams) => Pick<CentralNowSeed, 'model' | 'agents' | 'cards' | 'source'>
> = {
  run: runSeed,
  orchestrated: orchestratedSeed,
  auto: autoSeed,
  agent: agentSeed,
  branches: runSeed,
  stale: runSeed,
  story: runSeed,
  'story-many': runSeed,
  'story-skipped': runSeed,
  'story-one-project': runSeed,
  finished: finishedSeed,
};

const STORY_COUNT: Partial<Record<CentralNowVariant, 7 | 9 | 20>> = {
  'story-skipped': 7,
  story: 9,
  'story-many': 20,
  'story-one-project': 9,
};

export const centralNowSeedOf = ({ variant }: SeedParams): CentralNowSeed => {
  const storyCount = STORY_COUNT[variant];
  const story =
    storyCount === undefined
      ? null
      : centralStorySeedOf({
          count: storyCount,
          repo: variant === 'story-one-project' ? 'payments-api' : null,
        });
  return {
    ...BY_VARIANT[variant]({ variant }),
    facts: story === null ? factsOf({ variant }) : story.facts,
    branchCards: story === null ? [] : story.cards,
    doneOutcome: variant === 'finished' ? 'Fixed the failing lint check' : null,
  };
};
