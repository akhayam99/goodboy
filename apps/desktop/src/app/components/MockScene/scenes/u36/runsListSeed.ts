import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type Project,
  type ProjectId,
  type SessionMountView,
  type WorkflowRun,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import type { GroupBy } from '../../../../../store/slices/session-grouping/state';
import { sceneClock } from '../../sceneClock';
import { C08_SESSION_ID, C08_WORKSPACE_ID } from '../u25/c08RunSeed';

const clock = sceneClock({ anchor: '2026-10-16T15:12:00.000Z' });

const NOW: IsoDateTime = clock.iso({ at: '2026-10-16T15:00:00.000Z' });

const PAYMENTS_ID = brandId<ProjectId>({ value: 'mock-u36-project-payments-api' });
const LEDGER_ID = brandId<ProjectId>({ value: 'mock-u36-project-ledger-core' });
const NOTIFY_ID = brandId<ProjectId>({ value: 'mock-u36-project-notify-relay' });

const DUP_MOUNT = brandId<MountId>({ value: 'mock-u36-mount-duplicate-credit' });
const BACKFILL_MOUNT = brandId<MountId>({ value: 'mock-u36-mount-backfill' });
const RETRY_MOUNT = brandId<MountId>({ value: 'mock-u36-mount-retry-budget' });

const OVERRIDES: Project['overrides'] = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultBranchTemplate: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  workflowRules: null,
};

type ProjectParams = {
  readonly id: ProjectId;
  readonly name: string;
};

const projectOf = ({ id, name }: ProjectParams): Project => ({
  id,
  workspaceId: C08_WORKSPACE_ID,
  name,
  rootPath: `~/code/harborline/${name}`,
  kind: 'repo',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
});

type MountParams = {
  readonly id: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly branch: string;
};

const mountOf = ({ id, projectId, name, branch }: MountParams): SessionMountView => ({
  id,
  sessionId: C08_SESSION_ID,
  projectId,
  worktreePath: `~/code/harborline/${name}-worktree`,
  lastWorktreePath: null,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: name,
  repoSlug: `harborline/${name}`,
  repoRoot: `~/code/harborline/${name}`,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: NOW,
  updatedAt: NOW,
});

const MOUNTS: ReadonlyArray<SessionMountView> = [
  mountOf({
    id: DUP_MOUNT,
    projectId: PAYMENTS_ID,
    name: 'payments-api',
    branch: 'fix/duplicate-credit',
  }),
  mountOf({
    id: BACKFILL_MOUNT,
    projectId: LEDGER_ID,
    name: 'ledger-core',
    branch: 'rec/2-backfill',
  }),
  mountOf({
    id: RETRY_MOUNT,
    projectId: NOTIFY_ID,
    name: 'notify-relay',
    branch: 'feat/retry-budget',
  }),
];

const PROJECTS: ReadonlyArray<Project> = [
  projectOf({ id: PAYMENTS_ID, name: 'payments-api' }),
  projectOf({ id: LEDGER_ID, name: 'ledger-core' }),
  projectOf({ id: NOTIFY_ID, name: 'notify-relay' }),
];

const MOUNT_BY_TITLE: Readonly<Record<string, MountId>> = {
  'Fix flaky tests in the ledger export': BACKFILL_MOUNT,
  'Document the payments-api retry cap': DUP_MOUNT,
};

type RunParams = {
  readonly run: WorkflowRun;
};

const mountOfRun = ({ run }: RunParams): MountId | undefined => MOUNT_BY_TITLE[run.title ?? ''];

const STOPPED_ID = brandId<AgentId>({ value: 'mock-u36-stopped-agent' });

const stoppedAgent = (): Agent => ({
  id: STOPPED_ID,
  sessionId: C08_SESSION_ID,
  ordinal: 9,
  name: 'Replay the failed webhooks',
  kind: 'implementer',
  status: 'stopped',
  stoppedBy: 'you',
  startedAt: clock.iso({ at: '2026-10-16T15:06:00.000Z' }),
  mountId: RETRY_MOUNT,
});

const READY_TITLE = 'Document the export batching';

const readyStepAgent = (): ReadonlyArray<Agent> => {
  const state = useAppStore.getState();
  const run = sessionById(state.sessions, C08_SESSION_ID)?.workflowRuns.find(
    (candidate) => candidate.title === READY_TITLE,
  );
  const step = (state.sessionWorkflows[C08_SESSION_ID] ?? []).find(
    (workflow) => workflow.id === run?.workflowId,
  )?.steps[0];
  if (run === undefined || step === undefined) {
    return [];
  }
  return [
    {
      id: brandId<AgentId>({ value: 'mock-u36-ready-step' }),
      sessionId: C08_SESSION_ID,
      workflowRunId: run.id,
      stepId: step.id,
      ordinal: 8,
      name: step.name,
      kind: step.role,
      status: 'pending',
    },
  ];
};

const withMounts = (): void => {
  const state = useAppStore.getState();
  const session = sessionById(state.sessions, C08_SESSION_ID);
  const runs = session?.workflowRuns ?? [];
  const agents = (state.sessionPhaseRuns[C08_SESSION_ID] ?? []).map((agent) => {
    const run = runs.find((candidate) => candidate.id === agent.workflowRunId);
    const mountId = run === undefined ? undefined : mountOfRun({ run });
    return mountId === undefined ? agent : { ...agent, mountId };
  });
  useAppStore.setState({
    projects: PROJECTS,
    sessionMounts: { [C08_SESSION_ID]: MOUNTS },
    loadSessionMounts: async () => MOUNTS,
    loadPrSeries: async () => [],
    sessionPhaseRuns: { [C08_SESSION_ID]: [...agents, ...readyStepAgent(), stoppedAgent()] },
  });
};

type GroupParams = {
  readonly groupBy: GroupBy;
};

const choose = ({ groupBy }: GroupParams): void => {
  useAppStore.getState().setGroupBy({ sessionId: C08_SESSION_ID, groupBy });
};

export const seedRunsByBranch = (): void => {
  withMounts();
  choose({ groupBy: 'branch' });
};

export const seedRunsByState = (): void => {
  withMounts();
  choose({ groupBy: 'state' });
};

export const seedRunsEmpty = (): void => {
  const state = useAppStore.getState();
  useAppStore.setState({
    sessions: state.sessions.map((session) =>
      session.id === C08_SESSION_ID ? { ...session, workflowRuns: [] } : session,
    ),
    sessionPhaseRuns: { [C08_SESSION_ID]: [] },
  });
};
