import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type RunRoute,
  type WorkflowRun,
} from '@goodboy/types';
import { aMountView } from '../../../../../features/session/testing/aMountView';
import { runRoutesKey } from '../../../../../features/session/startRun/runRoutesSetting';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { autoSceneOf } from '../u24/autoSceneSeed';
import { C08_RUN_ID, C08_SESSION_ID } from '../u25/c08RunSeed';
import { seedRunsByState } from '../u36/runsListSeed';

const clock = sceneClock({ anchor: '2026-10-16T15:12:00.000Z' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-10-16T${time}:00.000Z` });

type KeyParams = {
  readonly key: string;
};

const idOf = ({ key }: KeyParams): AgentId => brandId<AgentId>({ value: `mock-u44-${key}` });

export const U44_PLAN_LEAD_ID = idOf({ key: 'lead-retry-dedupe' });

export const U44_WORK_LEAD_ID = idOf({ key: 'lead-export-batch' });

const PLAN_NAME = 'Fix flaky tests';

type AgentParams = {
  readonly key: string;
  readonly name: string;
  readonly kind: string;
  readonly status: Agent['status'];
  readonly ordinal: number;
  readonly time: string;
  readonly parentAgentId?: AgentId;
};

const agentOf = ({
  key,
  name,
  kind,
  status,
  ordinal,
  time,
  parentAgentId,
}: AgentParams): Agent => ({
  id: idOf({ key }),
  sessionId: C08_SESSION_ID,
  ordinal,
  name,
  kind,
  status,
  startedAt: at({ time }),
  ...(parentAgentId === undefined ? {} : { parentAgentId }),
});

const LEAD_AGENTS: ReadonlyArray<Agent> = [
  agentOf({
    key: 'lead-retry-dedupe',
    name: 'Stop retried webhooks posting a second credit',
    kind: 'auto',
    status: 'completed',
    ordinal: 20,
    time: '15:07',
  }),
  agentOf({
    key: 'planner-retry-dedupe',
    name: 'Plan the fix',
    kind: 'planner',
    status: 'completed',
    ordinal: 21,
    time: '15:08',
    parentAgentId: U44_PLAN_LEAD_ID,
  }),
  agentOf({
    key: 'scout-retry-dedupe',
    name: 'Find the second credit',
    kind: 'scout',
    status: 'completed',
    ordinal: 22,
    time: '15:08',
    parentAgentId: U44_PLAN_LEAD_ID,
  }),
  agentOf({
    key: 'lead-export-batch',
    name: 'Batch the ledger export',
    kind: 'auto',
    status: 'running',
    ordinal: 23,
    time: '14:50',
  }),
  agentOf({
    key: 'implementer-export-batch',
    name: 'Batch the export rows',
    kind: 'implementer',
    status: 'running',
    ordinal: 24,
    time: '14:55',
    parentAgentId: U44_WORK_LEAD_ID,
  }),
  agentOf({
    key: 'tester-export-batch',
    name: 'Test the batch boundary',
    kind: 'tester',
    status: 'pending',
    ordinal: 25,
    time: '14:56',
    parentAgentId: U44_WORK_LEAD_ID,
  }),
];

export const U44_PLAN_ROUTE: RunRoute = {
  shape: 'lead',
  row: 6,
  presetName: PLAN_NAME,
  closeness: 'adapt',
  role: null,
  choice: 'Lead',
  why: 'The Lead follows Fix flaky tests as its plan.',
};

const planReadyView = () => {
  const { view } = autoSceneOf({ state: 'plan' });
  const startedAt = Date.parse(at({ time: '15:07' }));
  return {
    ...view,
    tree: {
      ...view.tree,
      rootAgentId: U44_PLAN_LEAD_ID,
      sessionId: C08_SESSION_ID,
      createdAt: startedAt,
      updatedAt: startedAt,
    },
  };
};

type BranchParams = {
  readonly agentId: AgentId;
  readonly key: string;
  readonly branch: string;
};

const BRANCHES: ReadonlyArray<BranchParams> = [
  { agentId: U44_PLAN_LEAD_ID, key: 'u44-retry-dedupe', branch: 'feat/retry-dedupe' },
  { agentId: U44_WORK_LEAD_ID, key: 'u44-export-batch', branch: 'feat/export-batch' },
];

const withLeadBranches = (): void => {
  const state = useAppStore.getState();
  const payments = (state.sessionMounts[C08_SESSION_ID] ?? []).find(
    (mount) => mount.mountName === 'payments-api',
  );
  if (payments === undefined) {
    return;
  }
  const mounts = BRANCHES.map(({ key, branch }) =>
    aMountView({
      key,
      sessionId: C08_SESSION_ID,
      projectId: payments.projectId,
      projectName: 'payments-api',
      branch,
    }),
  );
  const mountByAgent = new Map(
    BRANCHES.map(({ agentId }, index) => [agentId, mounts[index]?.id] as const),
  );
  useAppStore.setState({
    sessionMounts: {
      ...state.sessionMounts,
      [C08_SESSION_ID]: [...(state.sessionMounts[C08_SESSION_ID] ?? []), ...mounts],
    },
    loadSessionMounts: async () => [...(state.sessionMounts[C08_SESSION_ID] ?? []), ...mounts],
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [C08_SESSION_ID]: [
        ...(state.sessionPhaseRuns[C08_SESSION_ID] ?? []),
        ...LEAD_AGENTS.map((agent) => {
          const mountId = mountByAgent.get(agent.id);
          return mountId === undefined ? agent : { ...agent, mountId };
        }),
      ],
    },
  });
};

const withOlderOrchestratedRun = (): void => {
  const state = useAppStore.getState();
  useAppStore.setState({
    sessions: state.sessions.map((session) =>
      session.id === C08_SESSION_ID
        ? {
            ...session,
            workflowRuns: session.workflowRuns.map((run): WorkflowRun =>
              run.id === C08_RUN_ID ? { ...run, executionMode: 'dynamic' } : run,
            ),
          }
        : session,
    ),
  });
};

export const seedU44Runs = (): void => {
  seedRunsByState();
  withOlderOrchestratedRun();
  withLeadBranches();
  const state = useAppStore.getState();
  useAppStore.setState({
    agentKindOverride: {
      ...state.agentKindOverride,
      [U44_PLAN_LEAD_ID]: 'auto',
      [U44_WORK_LEAD_ID]: 'auto',
    },
    autoTreeViews: { ...state.autoTreeViews, [C08_SESSION_ID]: [planReadyView()] },
    loadAutoTrees: async () => undefined,
    settings: {
      ...state.settings,
      [runRoutesKey({ sessionId: C08_SESSION_ID })]: JSON.stringify({
        [U44_PLAN_LEAD_ID]: U44_PLAN_ROUTE,
      }),
    },
  });
};
