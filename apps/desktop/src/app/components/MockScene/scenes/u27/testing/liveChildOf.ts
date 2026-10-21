import { brandId, type Agent, type AgentId, type AutoTreeId } from '@goodboy/types';
import { aDelegation } from '../../../../../../features/auto/testing/autoViewFixtures';
import type { AutoTreeView } from '../../../../../../store/slices/auto-view/state';
import { sceneClock } from '../../../sceneClock';
import { TREE_AGENTS, TREE_LIVE_ROOT_ID, TREE_SESSION, TREE_VIEWS } from '../agentsTreeSeed';

const clock = sceneClock({ anchor: '2026-10-20T11:00:00.000Z' });

type AtParams = {
  readonly minute: number;
};

const atOf = ({ minute }: AtParams): string =>
  new Date(Date.UTC(2026, 9, 20, 9, 0) + minute * 60_000).toISOString();

type LiveChildParams = {
  readonly key: string;
  readonly title: string;
  readonly minute: number;
};

type LiveChild = Readonly<{
  agent: Agent;
  delegation: AutoTreeView['delegations'][number];
}>;

export const liveChildOf = ({ key, title, minute }: LiveChildParams): LiveChild => {
  const [view] = TREE_VIEWS;
  const root = TREE_AGENTS.find((agent) => agent.id === TREE_LIVE_ROOT_ID);
  const treeId = view?.tree.id ?? brandId<AutoTreeId>({ value: 'mock-tree-live' });
  const childAgentId = brandId<AgentId>({ value: `mock-child-${key}` });
  return {
    agent: {
      id: childAgentId,
      sessionId: TREE_SESSION.id,
      ordinal: (root?.ordinal ?? 0) * 100 + 50,
      name: 'scout',
      status: 'running',
      startedAt: clock.iso({ at: atOf({ minute }) }),
      parentAgentId: TREE_LIVE_ROOT_ID,
      lastViewedAt: clock.iso({ at: atOf({ minute: 120 }) }),
    },
    delegation: {
      ...aDelegation({ key, role: 'scout', state: 'running', outcome: null, settledAt: null }),
      treeId,
      childAgentId,
      request: { title, task: 'Look.' },
      createdAt: clock.ms({ at: atOf({ minute }) }),
      deadlineAt: clock.ms({ at: atOf({ minute: minute + 600 }) }),
    },
  };
};
