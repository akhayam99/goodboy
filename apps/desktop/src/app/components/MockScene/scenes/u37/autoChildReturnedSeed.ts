import {
  brandId,
  type Agent,
  type AgentId,
  type AutoDelegationId,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import type { AutoDelegation } from '@goodboy/db';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { seedC07 } from '../u25/c07/c07AutoSeed';
import { AUTO_SESSION, TESTER_ID } from '../u24/autoSceneSeed';

export type AutoChildReturnedState = 'today' | 'returned' | 'decided' | 'asks';

const clock = sceneClock({ anchor: '2026-10-13T12:21:00.000Z' });

const REWRITER_ID = brandId<AgentId>({ value: 'mock-auto-rewriter-returned' });

const RUN_PLAIN = brandId<ProviderRunId>({ value: 'mock-auto-returned-plain-run' });

const MOUNT_ID = 'mock-mount-payments-api';

const BRANCH = 'feature/ledger-drawers';

const REQUEST = 'Needs a shell to run the retry tests of payments-api on feature/ledger-drawers.';

const SETTLED_AT = clock.ms({ at: '2026-10-13T12:13:52.000Z' });

const PLAIN_TURN: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: RUN_PLAIN,
    text: 'Why did it stop? Keep going.',
    at: clock.iso({ at: '2026-10-13T12:15:00.000Z' }),
  },
  {
    kind: 'assistant_text',
    runId: RUN_PLAIN,
    delta: 'Done: the retry tests pass on feature/ledger-drawers.',
    at: clock.iso({ at: '2026-10-13T12:15:30.000Z' }),
  },
];

type ChildParams = {
  readonly template: AutoDelegation;
  readonly state: AutoChildReturnedState;
};

const childOf = ({ template, state }: ChildParams): AutoDelegation => ({
  ...template,
  id: brandId<AutoDelegationId>({ value: 'mock-auto-delegation-returned' }),
  childAgentId: TESTER_ID,
  role: 'tester',
  slot: 0,
  request: {
    task: 'Run the retry tests of payments-api.',
    reason: 'Checks the credit retry path from the plan.',
  },
  target: { mountName: 'payments-api', mountId: MOUNT_ID, branch: BRANCH },
  state: 'settled',
  outcome: state === 'today' ? 'failed' : 'blocked',
  reason: state === 'today' ? 'process_error' : 'declared_blocked',
  result: state === 'today' ? null : { declared: { summary: REQUEST } },
  settledAt: SETTLED_AT,
});

const nextOf = ({ template }: Pick<ChildParams, 'template'>): AutoDelegation => ({
  ...template,
  id: brandId<AutoDelegationId>({ value: 'mock-auto-delegation-rewriter-returned' }),
  childAgentId: REWRITER_ID,
  role: 'implementer',
  slot: 1,
  request: {
    task: 'Run the retry tests of payments-api with a shell.',
    reason: 'The Tester asked for a shell.',
  },
  target: { mountName: 'payments-api', mountId: MOUNT_ID, branch: BRANCH },
  state: 'running',
  outcome: null,
  reason: null,
  result: null,
  createdAt: SETTLED_AT + 1_000,
  settledAt: null,
});

type AgentsParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly isDecided: boolean;
};

const agentsOf = ({ agents, isDecided }: AgentsParams): ReadonlyArray<Agent> => {
  const template = agents.find((agent) => agent.kind === 'planner');
  if (template === undefined) {
    return agents;
  }
  const tester: Agent = { ...template, id: TESTER_ID, name: 'Tester', kind: 'tester' };
  const rewriter: Agent = {
    ...template,
    id: REWRITER_ID,
    name: 'Implementer',
    kind: 'implementer',
    status: 'running',
  };
  const kept = agents.filter((agent) => agent.id !== TESTER_ID);
  return [...kept, tester, ...(isDecided ? [rewriter] : [])];
};

type SeedParams = {
  readonly state: AutoChildReturnedState;
};

export const seedAutoChildReturned = ({ state }: SeedParams): void => {
  const isAsks = state === 'asks';
  seedC07({
    state: isAsks ? 'plan' : 'done',
    place: isAsks ? 'auto' : 'child',
    pane: 'tester',
  });
  const isDecided = state === 'decided' || isAsks;
  useAppStore.setState((current) => {
    const views = current.autoTreeViews[AUTO_SESSION.id] ?? [];
    const runs = current.sessionPhaseRuns[AUTO_SESSION.id] ?? [];
    const transcript = current.transcripts[TESTER_ID] ?? [];
    return {
      autoTreeViews: {
        [AUTO_SESSION.id]: views.map((view) => {
          const template = view.delegations[0];
          if (template === undefined) {
            return view;
          }
          const kept = view.delegations.filter(
            (delegation) => delegation.childAgentId !== TESTER_ID,
          );
          return {
            ...view,
            delegations: [
              ...kept,
              childOf({ template, state }),
              ...(isDecided ? [nextOf({ template })] : []),
            ],
          };
        }),
      },
      sessionPhaseRuns: { [AUTO_SESSION.id]: agentsOf({ agents: runs, isDecided }) },
      transcripts: {
        ...current.transcripts,
        [TESTER_ID]: state === 'today' ? [...transcript, ...PLAIN_TURN] : transcript,
      },
    };
  });
};
