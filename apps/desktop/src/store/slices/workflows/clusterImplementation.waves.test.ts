// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type ImplementationCluster,
  type IsoDateTime,
  type PlanConsumptionId,
  type PlanId,
  type PlanWithCount,
  type SessionId,
} from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import type { SendTurnInput, SendTurnResult } from '../turn/types';
import { clusterLaunching } from './clusterWaves/clusterLaunching';
import {
  STORE_IMPORT_TIMEOUT_MS,
  connectedAnthropicState,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

const hoisted = vi.hoisted(() => ({
  insertBatch: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () => ({
  ...(await import('../../storyHarness')).workflowsModuleMock(),
  invokeAgentInsertBatch: hoisted.insertBatch,
}));
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const PARENT_ID = brandId<AgentId>({ value: 'impl-parent' });
const PLAN_ID = brandId<PlanId>({ value: 'plan-harborline' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-28T09:00:00.000Z' });

type Params = Readonly<{
  title: string;
  extra?: Partial<ImplementationCluster>;
}>;

const part = ({ title, extra = {} }: Params): ImplementationCluster => ({
  title,
  instructions: `do ${title}`,
  ...extra,
});

const sharedThenTwo: ReadonlyArray<ImplementationCluster> = [
  part({ title: 'routes', extra: { id: 'routes', touches: ['apps/web/src/routes.ts'] } }),
  part({
    title: 'home',
    extra: { id: 'home', after: ['routes'], touches: ['apps/web/src/home'] },
  }),
  part({
    title: 'chat',
    extra: { id: 'chat', after: ['routes'], touches: ['apps/web/src/chat'] },
  }),
  part({
    title: 'wrap',
    extra: { id: 'wrap', after: ['home', 'chat'], touches: ['docs/wrap.md'] },
  }),
];

const parent = (status: Agent['status'] = 'running'): Agent =>
  anAgent({
    id: PARENT_ID,
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'Implementer',
    status,
    kind: 'implementer',
  });

const child = (ordinal: number, status: Agent['status'] = 'pending'): Agent =>
  anAgent({
    id: brandId<AgentId>({ value: `part-${ordinal}` }),
    sessionId: SESSION_ID,
    parentAgentId: PARENT_ID,
    ordinal,
    name: `part ${ordinal + 1}`,
    status,
    kind: 'implementer',
  });

const planOf = (clusters: ReadonlyArray<ImplementationCluster>): PlanWithCount => ({
  id: PLAN_ID,
  sessionId: SESSION_ID,
  agentId: brandId<AgentId>({ value: 'planner-harborline' }),
  title: 'goal',
  bodyMd: '',
  status: 'active',
  consumptionCount: 0,
  createdAt: NOW,
  updatedAt: NOW,
  clusters,
});

let useAppStore: StoryStore;

const sendTurn = vi.fn<(input: SendTurnInput) => Promise<SendTurnResult>>(async () => ({
  blockedOverBudget: false,
}));

type SeedParams = Readonly<{
  agents: ReadonlyArray<Agent>;
  clusters: ReadonlyArray<ImplementationCluster>;
}>;

const seed = ({ agents, clusters }: SeedParams): void => {
  storySpies.invokeAgentList.mockResolvedValue(agents);
  useAppStore.setState({
    ...connectedAnthropicState(),
    sessions: [aSession({ id: SESSION_ID })],
    sessionPhaseRuns: { [SESSION_ID]: agents },
    sessionPlans: { [SESSION_ID]: [planOf(clusters)] },
    planConsumptions: {
      [PLAN_ID]: [
        {
          id: brandId<PlanConsumptionId>({ value: 'consumption-harborline' }),
          planId: PLAN_ID,
          agentId: PARENT_ID,
          agentName: null,
          consumedAt: NOW,
        },
      ],
    },
    sendTurn,
  });
};

type AdvanceParams = Readonly<{
  id: string;
  agents: ReadonlyArray<Agent>;
}>;

const advance = ({ id, agents }: AdvanceParams) => {
  storySpies.invokeAgentList.mockResolvedValue(agents);
  return useAppStore
    .getState()
    .advanceClusterImplementation(
      SESSION_ID,
      brandId<AgentId>({ value: id }),
      `<<cluster-done id="${id}">>`,
    );
};

const sentTo = (): ReadonlyArray<string> => sendTurn.mock.calls.map(([sent]) => sent.agentId ?? '');

const contentOf = (id: string): string => {
  const call = sendTurn.mock.calls.find(([sent]) => sent.agentId === id);
  return call === undefined ? '' : call[0].content;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  sendTurn.mockReset();
  sendTurn.mockImplementation(async () => ({ blockedOverBudget: false }));
  hoisted.insertBatch.mockReset();
  hoisted.insertBatch.mockImplementation(
    async ({ children }: { readonly children: ReadonlyArray<unknown> }) => ({
      inserted: true,
      agents: children.map((_, index) => child(index)),
    }),
  );
  storySpies.invokeAgentUpdateStatus.mockResolvedValue(undefined);
  storySpies.listConsumptionsForPlan.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('fan-out in waves', () => {
  const fanOut = async (clusters: ReadonlyArray<ImplementationCluster>) => {
    const { fanOutClusters } = await import('./clusterImplementation');
    seed({ agents: [parent()], clusters });
    await fanOutClusters(
      useAppStore.setState,
      useAppStore.getState,
      SESSION_ID,
      parent('pending'),
      clusters,
      'goal',
    );
  };

  it('starts every part of the first wave together', async () => {
    await fanOut([
      part({ title: 'ledger', extra: { touches: ['packages/ledger-core/src'] } }),
      part({ title: 'relay', extra: { touches: ['packages/notify-relay/src'] } }),
      part({ title: 'payments', extra: { touches: ['packages/payments-api/src'] } }),
    ]);

    expect(sentTo()).toEqual(['part-0', 'part-1', 'part-2']);
    expect(contentOf('part-0')).toContain('**Running at the same time** 2. relay, 3. payments');
  });

  it('starts only the shared first part and holds the parts that come after it', async () => {
    await fanOut(sharedThenTwo);

    expect(sentTo()).toEqual(['part-0']);
    expect(contentOf('part-0')).not.toContain('Running at the same time');
  });

  it('runs parts that touch the same file one at a time', async () => {
    await fanOut([
      part({ title: 'a', extra: { touches: ['src/routes.ts', 'src/a.ts'] } }),
      part({ title: 'b', extra: { touches: ['src/routes.ts', 'src/b.ts'] } }),
      part({ title: 'c', extra: { touches: ['src/c.ts'] } }),
    ]);

    expect(sentTo()).toEqual(['part-0', 'part-2']);
  });

  it('runs parts with no touches one at a time, in order', async () => {
    await fanOut([part({ title: 'a' }), part({ title: 'b' }), part({ title: 'c' })]);

    expect(sentTo()).toEqual(['part-0']);
  });

  it('falls back to the computed waves when after is cyclic', async () => {
    await fanOut([
      part({ title: 'a', extra: { id: 'a', after: ['b'], touches: ['src/a'] } }),
      part({ title: 'b', extra: { id: 'b', after: ['a'], touches: ['src/b'] } }),
    ]);

    expect(sentTo()).toEqual(['part-0', 'part-1']);
  });
});

describe('advance in waves', () => {
  const runs = (statuses: ReadonlyArray<Agent['status']>): ReadonlyArray<Agent> => [
    parent(),
    ...statuses.map((status, index) => child(index, status)),
  ];

  it('starts both parts that come after the shared part when it finishes', async () => {
    seed({ agents: runs(['running', 'pending', 'pending', 'pending']), clusters: sharedThenTwo });

    await advance({ id: 'part-0', agents: runs(['completed', 'pending', 'pending', 'pending']) });

    expect(sentTo()).toEqual(['part-1', 'part-2']);
    expect(contentOf('part-1')).toContain('**Done before you** 1. routes');
    expect(contentOf('part-1')).toContain('**Running at the same time** 3. chat');
  });

  it('leaves a part alone when a hand start is already waiting to run it', async () => {
    const waiting = brandId<AgentId>({ value: 'part-1' });
    seed({ agents: runs(['running', 'pending', 'pending', 'pending']), clusters: sharedThenTwo });
    clusterLaunching.claim({ childId: waiting });

    await advance({ id: 'part-0', agents: runs(['completed', 'pending', 'pending', 'pending']) });
    clusterLaunching.release({ childId: waiting });

    expect(sentTo()).toEqual(['part-2']);
  });

  it('starts nothing while a part of the same wave is still running', async () => {
    seed({ agents: runs(['completed', 'running', 'running', 'pending']), clusters: sharedThenTwo });

    await advance({ id: 'part-1', agents: runs(['completed', 'completed', 'running', 'pending']) });

    expect(sentTo()).toEqual([]);
    expect(storySpies.invokeAgentUpdateStatus).not.toHaveBeenCalledWith(
      PARENT_ID,
      expect.objectContaining({ status: 'blocked' }),
    );
  });

  it('starts the last part once both parts it comes after are done', async () => {
    seed({
      agents: runs(['completed', 'completed', 'running', 'pending']),
      clusters: sharedThenTwo,
    });

    await advance({
      id: 'part-2',
      agents: runs(['completed', 'completed', 'completed', 'pending']),
    });

    expect(sentTo()).toEqual(['part-3']);
    expect(contentOf('part-3')).toContain('**Done before you** 1. routes, 2. home, 3. chat');
  });

  it('starts a part once when both parts it comes after finish at the same time', async () => {
    seed({ agents: runs(['completed', 'running', 'running', 'pending']), clusters: sharedThenTwo });
    sendTurn.mockImplementation(() => new Promise<SendTurnResult>(() => undefined));
    const finished = runs(['completed', 'completed', 'completed', 'pending']);

    await Promise.all([
      advance({ id: 'part-1', agents: finished }),
      advance({ id: 'part-2', agents: finished }),
    ]);

    expect(sentTo()).toEqual(['part-3']);
  });

  it('completes the container when the last part is done', async () => {
    seed({
      agents: runs(['completed', 'completed', 'completed', 'running']),
      clusters: sharedThenTwo,
    });

    await advance({
      id: 'part-3',
      agents: runs(['completed', 'completed', 'completed', 'completed']),
    });

    expect(sentTo()).toEqual([]);
    expect(storySpies.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      PARENT_ID,
      expect.objectContaining({ status: 'completed' }),
    );
  });
});

describe('resume in waves', () => {
  const runs = (statuses: ReadonlyArray<Agent['status']>): ReadonlyArray<Agent> => [
    parent(),
    ...statuses.map((status, index) => child(index, status)),
  ];

  const resume = async (agents: ReadonlyArray<Agent>) => {
    const { resumeClusterChildren } = await import('./clusterImplementation');
    seed({ agents, clusters: sharedThenTwo });
    return resumeClusterChildren({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      container: parent(),
    });
  };

  it('starts a pending part whose blockers are done while its sibling still runs', async () => {
    const hasStarted = await resume(runs(['completed', 'running', 'pending', 'pending']));

    expect(hasStarted).toBe(true);
    expect(sentTo()).toEqual(['part-2']);
  });

  it('starts nothing when every pending part waits on a running one', async () => {
    const hasStarted = await resume(runs(['completed', 'running', 'running', 'pending']));

    expect(hasStarted).toBe(false);
    expect(sentTo()).toEqual([]);
  });
});
