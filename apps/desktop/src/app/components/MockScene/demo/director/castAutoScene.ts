import type { AutoDelegation } from '@goodboy/db';
import { brandId, type Agent, type AutoDelegationId } from '@goodboy/types';
import {
  IMPLEMENTER_ID,
  PLANNER_ID,
  TESTER_ID,
  type AutoSceneData,
} from '../../scenes/u24/autoSceneSeed';
import { AUTO_STORY, LEDGER_ID } from './autoStory';

type Params = {
  readonly scene: AutoSceneData;
};

type TaskParams = {
  readonly delegation: AutoDelegation;
  readonly task: string;
  readonly summary?: string;
  readonly files?: ReadonlyArray<string>;
};

type ValueParams = {
  readonly value: unknown;
};

const recordOf = ({ value }: ValueParams): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

const resultOf = ({
  delegation,
  summary,
  files,
}: Pick<TaskParams, 'delegation' | 'summary' | 'files'>): unknown => {
  const { result } = delegation;
  const record = recordOf({ value: result });
  if (record === null || summary === undefined) {
    return result;
  }
  const verified = recordOf({ value: record.verified });
  return {
    ...record,
    declared: { summary },
    ...(verified !== null && files !== undefined
      ? {
          verified: {
            ...verified,
            changedFiles: files.map((path) => ({ path, ownership: 'attempt' })),
          },
        }
      : {}),
  };
};

const retold = ({ delegation, task, summary, files }: TaskParams): AutoDelegation => ({
  ...delegation,
  request: { ...delegation.request, task },
  result: resultOf({ delegation, summary, files }),
});

type LedgerParams = {
  readonly tester: AutoDelegation;
};

const ledgerOf = ({ tester }: LedgerParams): AutoDelegation => ({
  ...retold({
    delegation: tester,
    task: AUTO_STORY.ledgerTask,
    summary: AUTO_STORY.ledgerSummary,
    files: ['src/postings/postEntry.ts'],
  }),
  id: brandId<AutoDelegationId>({ value: 'mock-auto-delegation-ledger' }),
  childAgentId: LEDGER_ID,
  role: 'implementer',
  slot: 1,
  target: { mountName: 'ledger-core' },
});

type DelegationsParams = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

const delegationsOf = ({ delegations }: DelegationsParams) =>
  delegations.flatMap((delegation): ReadonlyArray<AutoDelegation> => {
    if (delegation.childAgentId === PLANNER_ID && delegation.reviseOf === null) {
      return [retold({ delegation, task: AUTO_STORY.plannerTask })];
    }
    if (delegation.childAgentId === IMPLEMENTER_ID) {
      return [
        retold({
          delegation,
          task: AUTO_STORY.implementerTask,
          summary: AUTO_STORY.implementerSummary,
          files: ['src/webhooks/eventGuard.ts', 'src/webhooks/applyWebhook.ts'],
        }),
      ];
    }
    if (delegation.childAgentId === TESTER_ID) {
      const tester = retold({
        delegation: {
          ...delegation,
          state: delegation.state === 'accepted' ? 'running' : delegation.state,
        },
        task: AUTO_STORY.testerTask,
        summary: AUTO_STORY.testerSummary,
      });
      return [tester, ledgerOf({ tester })];
    }
    if (delegation.role === 'reviewer') {
      return [retold({ delegation, task: AUTO_STORY.reviewerTask })];
    }
    return [delegation];
  });

type AgentsParams = {
  readonly agents: ReadonlyArray<Agent>;
};

const agentsOf = ({ agents }: AgentsParams) =>
  agents.flatMap((agent): ReadonlyArray<Agent> => {
    if (agent.id === TESTER_ID) {
      const tester: Agent = agent.status === 'pending' ? { ...agent, status: 'running' } : agent;
      return [
        tester,
        { ...tester, id: LEDGER_ID, name: 'Ledger implementer', kind: 'implementer' },
      ];
    }
    return [agent];
  });

export const castAutoScene = ({ scene }: Params): AutoSceneData => ({
  ...scene,
  view: { ...scene.view, delegations: delegationsOf({ delegations: scene.view.delegations }) },
  agents: agentsOf({ agents: scene.agents }),
});
