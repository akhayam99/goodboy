import { useEffect, useState } from 'react';
import type {
  IsoDateTime,
  MountBranchObservation,
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionMountView,
  SessionProjectMount,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { useAppStore } from '../../../../store';

const WORKSPACE_ID = 'mock-workspace-harborline' as WorkspaceId;
const SESSION_ID = 'mock-session-mount-mismatch' as SessionId;
const LEDGER_ID = 'mock-project-ledger-core' as ProjectId;
const RELAY_ID = 'mock-project-notify-relay' as ProjectId;
const NOW = '2026-09-09T09:12:00.000Z' as IsoDateTime;

const ROUNDING_MOUNT = 'mock-mount-ledger-rounding' as MountId;
const POSTINGS_MOUNT = 'mock-mount-ledger-postings' as MountId;
const RELAY_MOUNT = 'mock-mount-relay-backoff' as MountId;

const ROUNDING_BRANCH = 'fix/ledger-reconciliation-rounding-drift';
const POSTINGS_BRANCH = 'fix/ledger-reconciliation-idempotent-postings';
const RELAY_BRANCH = 'fix/notify-relay-webhook-rate-limit-backoff';
const RELAY_OBSERVED = 'fix/notify-relay-retry-budget';

const LEDGER_ROOT = '/mock/harborline/ledger-core';
const RELAY_ROOT = '/mock/harborline/notify-relay';

const OVERRIDES = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  sessionsRoot: '/mock/harborline/sessions',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const PROJECTS: ReadonlyArray<Project> = [
  {
    id: LEDGER_ID,
    workspaceId: WORKSPACE_ID,
    name: 'ledger-core',
    rootPath: LEDGER_ROOT,
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: RELAY_ID,
    workspaceId: WORKSPACE_ID,
    name: 'notify-relay',
    rootPath: RELAY_ROOT,
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

type MountSeed = {
  readonly id: MountId;
  readonly projectId: ProjectId;
  readonly mountName: string;
  readonly branch: string;
  readonly repoRoot: string;
  readonly worktreePath: string;
  readonly parallelIndex: number;
};

const MOUNT_SEEDS: ReadonlyArray<MountSeed> = [
  {
    id: ROUNDING_MOUNT,
    projectId: LEDGER_ID,
    mountName: 'ledger-core',
    branch: ROUNDING_BRANCH,
    repoRoot: LEDGER_ROOT,
    worktreePath: `${LEDGER_ROOT}-rounding`,
    parallelIndex: 0,
  },
  {
    id: POSTINGS_MOUNT,
    projectId: LEDGER_ID,
    mountName: 'ledger-core',
    branch: POSTINGS_BRANCH,
    repoRoot: LEDGER_ROOT,
    worktreePath: `${LEDGER_ROOT}-postings`,
    parallelIndex: 1,
  },
  {
    id: RELAY_MOUNT,
    projectId: RELAY_ID,
    mountName: 'notify-relay',
    branch: RELAY_BRANCH,
    repoRoot: RELAY_ROOT,
    worktreePath: `${RELAY_ROOT}-backoff`,
    parallelIndex: 0,
  },
];

const MOUNT_VIEWS: ReadonlyArray<SessionMountView> = MOUNT_SEEDS.map((seed) => ({
  id: seed.id,
  sessionId: SESSION_ID,
  projectId: seed.projectId,
  worktreePath: seed.worktreePath,
  lastWorktreePath: seed.worktreePath,
  branch: seed.branch,
  baseBranch: 'main',
  parallelIndex: seed.parallelIndex,
  mountName: seed.mountName,
  repoSlug: `harborline/${seed.mountName}`,
  repoRoot: seed.repoRoot,
  isAttached: true,
  diskState: 'present',
  revision: 4,
  createdAt: NOW,
  updatedAt: NOW,
}));

const PROJECT_MOUNTS: ReadonlyArray<SessionProjectMount> = MOUNT_SEEDS.map((seed) => ({
  mountId: seed.id,
  projectId: seed.projectId,
  mountName: seed.mountName,
  worktreePath: seed.worktreePath,
  lastWorktreePath: seed.worktreePath,
  repoRoot: seed.repoRoot,
  branch: seed.branch,
  baseBranch: 'main',
  parallelIndex: seed.parallelIndex,
  diskState: 'present',
  revision: 4,
}));

const OBSERVATIONS: ReadonlyArray<MountBranchObservation> = [
  {
    mountId: ROUNDING_MOUNT,
    sessionId: SESSION_ID,
    state: 'mismatch',
    recordedBranch: ROUNDING_BRANCH,
    observedBranch: POSTINGS_BRANCH,
    revision: 4,
    observedAt: NOW,
  },
  {
    mountId: RELAY_MOUNT,
    sessionId: SESSION_ID,
    state: 'mismatch',
    recordedBranch: RELAY_BRANCH,
    observedBranch: RELAY_OBSERVED,
    revision: 4,
    observedAt: NOW,
  },
];

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Split the ledger reconciliation rewrite into reviewable parts and unblock the notify relay backoff',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: LEDGER_ID,
  createdAt: NOW,
  updatedAt: NOW,
};

export const MountMismatchScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: PROJECTS,
      sessions: [SESSION],
      currentSessionId: SESSION_ID,
      sessionMounts: { [SESSION_ID]: MOUNT_VIEWS },
      sessionProjectMounts: { [SESSION_ID]: PROJECT_MOUNTS },
      sessionActiveMount: { [SESSION_ID]: ROUNDING_MOUNT },
      sessionActiveProject: { [SESSION_ID]: LEDGER_ID },
      mountBranchObservations: { [SESSION_ID]: OBSERVATIONS },
      mountCleanupProposals: { [SESSION_ID]: [] },
      prSeries: { [SESSION_ID]: [] },
      mountGithub: {},
      mountGitlabMr: {},
      mountBitbucketPr: {},
      sessionWorktrees: { [SESSION_ID]: MOUNT_SEEDS.map((seed) => seed.worktreePath) },
      sessionWorktreeRecords: {
        [SESSION_ID]: MOUNT_SEEDS.map((seed, index) => ({
          id: `mock-worktree-${index}`,
          sessionId: SESSION_ID,
          worktreePath: seed.worktreePath,
          branch: seed.branch,
          parallelIndex: seed.parallelIndex,
          projectId: seed.projectId,
          mountName: seed.mountName,
          repoSlug: `harborline/${seed.mountName}`,
          createdAt: Date.parse(NOW),
        })),
      },
      sessionSlots: { [SESSION_ID]: [{ key: 'goal', value: SESSION.goal, enabled: true }] },
      sessionSlotsLoad: { [SESSION_ID]: 'loaded' },
      sessionLoading: {
        [SESSION_ID]: {
          agents: false,
          transcript: false,
          telemetry: false,
          slots: false,
          plans: false,
          summary: false,
        },
      },
      summarizerStatus: {
        [SESSION_ID]: {
          status: 'idle',
          lastUpdate: NOW,
          error: null,
          lastUsage: null,
          lastAttempt: null,
        },
      },
      sessionPhaseRuns: { [SESSION_ID]: [] },
      sessionPlans: { [SESSION_ID]: [] },
      sessionWorkflows: { [SESSION_ID]: [] },
      phaseTemplates: { [WORKSPACE_ID]: [] },
      sessionTelemetry: { [SESSION_ID]: [] },
      sessionExternalTasks: { [SESSION_ID]: [] },
      sessionProjectPrs: { [SESSION_ID]: {} },
      activeLens: { [SESSION_ID]: null },
      workspaceIntegrations: { [WORKSPACE_ID]: [] },
      sessionAttachments: { [SESSION_ID]: [] },
      slotHistory: { [SESSION_ID]: {} },
      slotHistoryCounts: { [SESSION_ID]: {} },
      terminalTabs: { [SESSION_ID]: [] },
      scriptRuns: { [SESSION_ID]: {} },
      projectScripts: { [WORKSPACE_ID]: [] },
      loadSessionMounts: async () => MOUNT_VIEWS,
      loadPrSeries: async () => [],
      loadMountCleanupProposals: async () => [],
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <SessionOverviewPane session={SESSION} onSelectLens={() => undefined} />
    </main>
  );
};
