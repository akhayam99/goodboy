// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../storyHarness';
import { clusterLaunching } from '../../workflows/clusterWaves/clusterLaunching';
import { cancelTurnStartWindow, resetTurnStartWindows } from '../turnStartWindow';
import { waitForClusterOverlap } from './waitForClusterOverlap';
import { writerWaiters } from '../writerWaiters';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../storyHarness')).dbModuleMock());

const SESSION_ID = brandId<SessionId>({ value: 'session-northwind' });
const PARENT_ID = brandId<AgentId>({ value: 'impl-parent' });
const PLAN_ID = brandId<PlanId>({ value: 'plan-northwind' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-28T09:00:00.000Z' });

type PartParams = Readonly<{
  title: string;
  touches: ReadonlyArray<string>;
}>;

const part = ({ title, touches }: PartParams): ImplementationCluster => ({
  title,
  instructions: `do ${title}`,
  touches,
});

const clusters: ReadonlyArray<ImplementationCluster> = [
  part({ title: 'routes', touches: ['apps/web/src/routes.ts', 'apps/web/src/a'] }),
  part({ title: 'home', touches: ['apps/web/src/routes.ts', 'apps/web/src/home'] }),
  part({ title: 'docs', touches: ['docs/home.md'] }),
];

const child = (ordinal: number, status: Agent['status']): Agent =>
  anAgent({
    id: brandId<AgentId>({ value: `part-${ordinal}` }),
    sessionId: SESSION_ID,
    parentAgentId: PARENT_ID,
    ordinal,
    name: clusters[ordinal]?.title ?? 'part',
    status,
    kind: 'implementer',
  });

const plan: PlanWithCount = {
  id: PLAN_ID,
  sessionId: SESSION_ID,
  agentId: brandId<AgentId>({ value: 'planner-northwind' }),
  title: 'goal',
  bodyMd: '',
  status: 'active',
  consumptionCount: 0,
  createdAt: NOW,
  updatedAt: NOW,
  clusters,
};

let useAppStore: StoryStore;

type SeedParams = Readonly<{
  statuses: ReadonlyArray<Agent['status']>;
  plans?: ReadonlyArray<PlanWithCount>;
}>;

const seed = ({ statuses, plans = [plan] }: SeedParams): void => {
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID })],
    sessionPhaseRuns: { [SESSION_ID]: statuses.map((status, index) => child(index, status)) },
    sessionPlans: { [SESSION_ID]: plans },
    planConsumptions: {
      [PLAN_ID]: [
        {
          id: brandId<PlanConsumptionId>({ value: 'consumption-northwind' }),
          planId: PLAN_ID,
          agentId: PARENT_ID,
          agentName: null,
          consumedAt: NOW,
        },
      ],
    },
  });
};

const startPart = (ordinal: number) =>
  waitForClusterOverlap({
    set: useAppStore.setState,
    get: useAppStore.getState,
    input: {
      sessionId: SESSION_ID,
      agentId: brandId<AgentId>({ value: `part-${ordinal}` }),
      content: 'start',
    },
  });

const flush = async (): Promise<void> => {
  for (let tick = 0; tick < 6; tick++) {
    await Promise.resolve();
  }
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetTurnStartWindows();
});

describe('waitForClusterOverlap', () => {
  it('lets a part start when no part of its plan is running', async () => {
    seed({ statuses: ['pending', 'pending', 'pending'] });

    await expect(startPart(1)).resolves.toBe('proceed');
  });

  it('lets a part start while a part on other files is running', async () => {
    seed({ statuses: ['pending', 'pending', 'running'] });

    await expect(startPart(1)).resolves.toBe('proceed');
  });

  it('lets a part with no plan start', async () => {
    seed({ statuses: ['running', 'pending'], plans: [] });

    await expect(startPart(1)).resolves.toBe('proceed');
  });

  it('does not hold a part that is already running', async () => {
    seed({ statuses: ['running', 'running'] });

    await expect(startPart(1)).resolves.toBe('proceed');
  });

  it('waits on the running part that touches the same file, names it, then goes on', async () => {
    seed({ statuses: ['running', 'pending', 'pending'] });

    const outcome = startPart(1);
    await flush();

    const wait = useAppStore.getState().agentWriterWait[brandId<AgentId>({ value: 'part-1' })];
    expect(wait?.blockedBy).toBe('part-0');
    expect(wait?.blockedPart).toBe('routes');
    expect(clusterLaunching.has({ childId: brandId<AgentId>({ value: 'part-1' }) })).toBe(true);
    expect(useAppStore.getState().agentTurnState[brandId<AgentId>({ value: 'part-1' })]?.kind).toBe(
      'starting',
    );

    seed({ statuses: ['completed', 'pending', 'pending'] });
    writerWaiters.wake();

    await expect(outcome).resolves.toBe('proceed');
    expect(useAppStore.getState().agentWriterWait).toEqual({});
  });

  it('stops waiting when the wait is cancelled', async () => {
    seed({ statuses: ['running', 'pending', 'pending'] });

    const outcome = startPart(1);
    await flush();
    cancelTurnStartWindow({ agentId: brandId<AgentId>({ value: 'part-1' }) });
    writerWaiters.wake();

    await expect(outcome).resolves.toBe('cancelled');
    expect(clusterLaunching.has({ childId: brandId<AgentId>({ value: 'part-1' }) })).toBe(false);
    expect(useAppStore.getState().agentWriterWait).toEqual({});
  });
});
