import type { AutoDelegation } from '@goodboy/db';
import type { Agent } from '@goodboy/types';
import {
  IMPLEMENTER_ID,
  PLANNER_ID,
  TESTER_ID,
  type AutoSceneData,
} from '../../scenes/u24/autoSceneSeed';
import { AUTO_STORY } from './autoStory';

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
        {
          ...retold({
            delegation,
            task: AUTO_STORY.implementerTask,
            summary: AUTO_STORY.implementerSummary,
            files: ['src/webhooks/eventGuard.ts', 'src/webhooks/applyWebhook.ts'],
          }),
          routing: { ...delegation.routing, provider: 'codex', model: 'gpt-5.6-sol' },
        },
      ];
    }
    if (delegation.childAgentId === TESTER_ID) {
      return [
        {
          ...retold({
            delegation: {
              ...delegation,
              state: delegation.state === 'accepted' ? 'running' : delegation.state,
            },
            task: AUTO_STORY.testerTask,
            summary: AUTO_STORY.testerSummary,
            files: [],
          }),
          target: { mountName: 'ledger-core' },
        },
      ];
    }
    if (delegation.role === 'reviewer') {
      return [];
    }
    return [delegation];
  });

export const castAutoScene = ({ scene }: Params): AutoSceneData => ({
  ...scene,
  view: { ...scene.view, delegations: delegationsOf({ delegations: scene.view.delegations }) },
  agents: scene.agents.flatMap((agent): ReadonlyArray<Agent> => {
    if (agent.kind === 'reviewer') {
      return [];
    }
    if (agent.id === PLANNER_ID) {
      const { parentAgentId: _parent, ...planner } = agent;
      return [planner];
    }
    if (agent.id === IMPLEMENTER_ID) {
      return [{ ...agent, providerOverride: 'codex', modelOverride: 'gpt-5.6-sol' }];
    }
    return [agent];
  }),
});
