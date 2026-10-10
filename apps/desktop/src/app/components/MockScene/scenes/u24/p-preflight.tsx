import { useEffect, useState } from 'react';
import type {
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionMountView,
  SessionProjectMount,
  Workspace,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { CreatePrPanel } from '../../../../../features/integrations/github/components/PullRequest/CreatePrPanel';
import { useAppStore } from '../../../../../store';
import type { ScribeWork } from '../../../../../store/slices/scribe/types';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });

const WORKSPACE_ID = 'mock-u24-workspace-harborline' as WorkspaceId;
const SESSION_ID = 'mock-u24-session-preflight' as SessionId;
const PROJECT_ID = 'mock-u24-project-ledger-core' as ProjectId;
const MOUNT_ID = 'mock-u24-mount-ledger-rounding' as MountId;
const NOW = clock.iso({ at: '2026-10-10T09:12:00.000Z' });

const ROOT = '~/code/harborline/ledger-core';
const WORKTREE = `${ROOT}-rounding`;
const BRANCH = 'fix/ledger-reconciliation-rounding-drift';
const HEAD = 'c0ffee123456';

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
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const PROJECT: Project = {
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: ROOT,
  kind: 'repo',
  baseBranch: 'main',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Round settlement totals to minor units',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: PROJECT_ID,
  createdAt: NOW,
  updatedAt: NOW,
};

const MOUNT_VIEW: SessionMountView = {
  id: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath: WORKTREE,
  lastWorktreePath: WORKTREE,
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'ledger-core',
  repoSlug: 'harborline/ledger-core',
  repoRoot: ROOT,
  isAttached: true,
  diskState: 'present',
  revision: 2,
  createdAt: NOW,
  updatedAt: NOW,
};

const PROJECT_MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  worktreePath: WORKTREE,
  lastWorktreePath: WORKTREE,
  repoRoot: ROOT,
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  diskState: 'present',
  revision: 2,
  sessionId: SESSION_ID,
  isAttached: true,
};

const DIRTY_STATUS: WorktreeStatus = {
  branch: BRANCH,
  head: HEAD,
  headSubject: 'Round settlement totals to minor units',
  upstream: `origin/${BRANCH}`,
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 3, behind: 18 },
  workingTree: { kind: 'known', staged: 4, unstaged: 5, untracked: 2, unmerged: 0, changed: 11 },
  inProgress: null,
};

const CLEAN_STATUS: WorktreeStatus = {
  ...DIRTY_STATUS,
  mainDistance: { kind: 'known', ahead: 3, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
};

const SCRIBE_WRITING: ScribeWork = {
  key: `pr:${MOUNT_ID}`,
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  agentId: null,
  task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true, base: null },
  status: 'writing',
  output: null,
  error: null,
  pullRequest: null,
  updatedAt: clock.ms({ at: '2026-10-10T09:12:00.000Z' }),
};

const answerWith =
  ({ status }: { readonly status: WorktreeStatus }) =>
  (command: string): unknown => {
    switch (command) {
      case 'worktree_status':
        return status;
      case 'gh_run':
        return { stdout: 'harborline/ledger-core', stderr: '', exitCode: 0 };
      default:
        return null;
    }
  };

const seed = ({ hasScribeJob }: { readonly hasScribeJob: boolean }): void => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PROJECT],
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    sessionMounts: { [SESSION_ID]: [MOUNT_VIEW] },
    sessionProjectMounts: { [SESSION_ID]: [PROJECT_MOUNT] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionBranches: { [SESSION_ID]: BRANCH },
    mountBranchObservations: { [SESSION_ID]: [] },
    mountCleanupProposals: { [SESSION_ID]: [] },
    prSeries: { [SESSION_ID]: [] },
    mountGithub: {},
    mountGitlabMr: {},
    mountBitbucketPr: {},
    scribeWork: hasScribeJob ? { [SCRIBE_WRITING.key]: SCRIBE_WRITING } : {},
    sessionWorktrees: { [SESSION_ID]: [WORKTREE] },
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
    loadSessionMounts: async () => [MOUNT_VIEW],
    loadPrSeries: async () => [],
    loadMountCleanupProposals: async () => [],
  });
};

type Props = {
  readonly view: 'overview' | 'pull-request';
};

const PreflightScene = ({ view }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc(answerWith({ status: view === 'overview' ? DIRTY_STATUS : CLEAN_STATUS }));
    seed({ hasScribeJob: view === 'pull-request' });
    setIsReady(true);
  }, [view]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      {view === 'overview' ? (
        <SessionOverviewPane session={SESSION} onSelectLens={() => undefined} />
      ) : (
        <CreatePrPanel
          sessionId={SESSION_ID}
          mountId={MOUNT_ID}
          defaultTitle={SESSION.goal}
          onCreated={() => undefined}
        />
      )}
    </main>
  );
};

export const U24_P_PREFLIGHT_SCENES = {
  rebasedirty: () => <PreflightScene view="overview" />,
  'branch-pr-scribe-writing': () => <PreflightScene view="pull-request" />,
};
