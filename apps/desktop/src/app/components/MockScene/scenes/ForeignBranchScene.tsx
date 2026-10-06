import { useEffect, useState } from 'react';
import type {
  MountId,
  Project,
  ProjectId,
  PullRequestState,
  Session,
  SessionId,
  SessionMountView,
  SessionProjectMount,
  Workspace,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { BranchSwitchPanel } from '../../../../features/worktree/BranchSwitchPanel';
import { useAppStore } from '../../../../store';
import { sceneClock } from '../sceneClock';
import { mockSceneIpc } from './mockSceneIpc';

const clock = sceneClock({ anchor: '2026-10-06T09:12:00.000Z' });

const WORKSPACE_ID = 'mock-workspace-harborline' as WorkspaceId;
const SESSION_ID = 'mock-session-foreign-branch' as SessionId;
const LEDGER_ID = 'mock-project-ledger-core' as ProjectId;
const REVIEW_MOUNT = 'mock-mount-ledger-review' as MountId;
const OWN_MOUNT = 'mock-mount-ledger-rounding' as MountId;
const NOW = clock.iso({ at: '2026-10-06T09:12:00.000Z' });

const LEDGER_ROOT = '~/code/harborline/ledger-core';
const TEAMMATE_BRANCH = 'grw-1348-cta-per-bypassare-la-selezione-dello-slot';
const OWN_BRANCH = 'fix/ledger-reconciliation-rounding-drift';
const BASE_SHA = 'a1b2c3d4e5f6';
const PR_SHA = '9f8e7d6c5b4a';

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
  id: LEDGER_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: LEDGER_ROOT,
  kind: 'repo',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Review the slot bypass pull request from the Northwind team',
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

type MountSeed = {
  readonly id: MountId;
  readonly branch: string;
  readonly worktreePath: string;
  readonly parallelIndex: number;
};

const MOUNT_SEEDS: ReadonlyArray<MountSeed> = [
  {
    id: REVIEW_MOUNT,
    branch: TEAMMATE_BRANCH,
    worktreePath: `${LEDGER_ROOT}-review`,
    parallelIndex: 0,
  },
  { id: OWN_MOUNT, branch: OWN_BRANCH, worktreePath: `${LEDGER_ROOT}-rounding`, parallelIndex: 1 },
];

const MOUNT_VIEWS: ReadonlyArray<SessionMountView> = MOUNT_SEEDS.map((seed) => ({
  id: seed.id,
  sessionId: SESSION_ID,
  projectId: LEDGER_ID,
  worktreePath: seed.worktreePath,
  lastWorktreePath: seed.worktreePath,
  branch: seed.branch,
  baseBranch: 'main',
  parallelIndex: seed.parallelIndex,
  mountName: 'ledger-core',
  repoSlug: 'harborline/ledger-core',
  repoRoot: LEDGER_ROOT,
  isAttached: true,
  diskState: 'present',
  revision: 2,
  createdAt: NOW,
  updatedAt: NOW,
}));

const PROJECT_MOUNTS: ReadonlyArray<SessionProjectMount> = MOUNT_SEEDS.map((seed) => ({
  mountId: seed.id,
  projectId: LEDGER_ID,
  mountName: 'ledger-core',
  worktreePath: seed.worktreePath,
  lastWorktreePath: seed.worktreePath,
  repoRoot: LEDGER_ROOT,
  branch: seed.branch,
  baseBranch: 'main',
  parallelIndex: seed.parallelIndex,
  diskState: 'present',
  revision: 2,
  sessionId: SESSION_ID,
  isAttached: true,
}));

const OPEN_PR: PullRequestState = {
  number: 9900,
  title: 'Add a CTA to skip the slot selection in time preference',
  url: 'https://github.com/harborline/ledger-core/pull/9900',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: TEAMMATE_BRANCH,
  isDraft: false,
  reviewDecision: 'review_required',
  body: '',
  updatedAt: NOW,
  headSha: PR_SHA,
  author: 'priya-northwind',
};

const STRANDED_STATUS: WorktreeStatus = {
  branch: TEAMMATE_BRANCH,
  head: BASE_SHA,
  headSubject: 'Merge pull request #9871 from harborline/fix-ledger-retry',
  upstream: `origin/${TEAMMATE_BRANCH}`,
  upstreamDistance: { kind: 'known', ahead: 0, behind: 2 },
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
};

const OWN_STATUS: WorktreeStatus = {
  ...STRANDED_STATUS,
  branch: OWN_BRANCH,
  head: 'c0ffee123456',
  headSubject: 'Round settlement totals to minor units',
  upstream: `origin/${OWN_BRANCH}`,
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 2, behind: 0 },
};

const LOCAL_BRANCHES = [
  { name: 'main', inUse: false, hasUncommitted: false },
  { name: OWN_BRANCH, inUse: true, hasUncommitted: false },
  { name: 'fix/notify-relay-retry-budget', inUse: false, hasUncommitted: false },
];

const REMOTE_BRANCHES = [
  {
    name: TEAMMATE_BRANCH,
    author: 'Priya Okafor',
    sha: PR_SHA,
    timestamp: 1791100000,
    hasLocal: false,
  },
  {
    name: 'acme-ledger-export-csv',
    author: 'Marco Lindqvist',
    sha: 'b7a6c5d4e3f2',
    timestamp: 1790900000,
    hasLocal: false,
  },
  {
    name: 'cascadia-fx-rounding-spike',
    author: 'Ines Varga',
    sha: 'd4c3b2a1f0e9',
    timestamp: 1790500000,
    hasLocal: false,
  },
];

const OPEN_PRS = [
  {
    number: 9900,
    title: OPEN_PR.title,
    headRefName: TEAMMATE_BRANCH,
    isDraft: false,
    isCrossRepository: false,
    author: { login: 'priya-northwind' },
  },
  {
    number: 9893,
    title: 'Export the ledger as CSV',
    headRefName: 'acme-ledger-export-csv',
    isDraft: true,
    isCrossRepository: false,
    author: { login: 'marco-acme' },
  },
];

type Props = {
  readonly state?: 'stranded' | 'picker';
};

const argOf = ({ args, key }: { readonly args: unknown; readonly key: string }): unknown =>
  typeof args === 'object' && args !== null ? Reflect.get(args, key) : undefined;

const answer = (command: string, args: unknown): unknown => {
  const worktreePath = argOf({ args, key: 'worktreePath' });
  const path = typeof worktreePath === 'string' ? worktreePath : '';
  switch (command) {
    case 'worktree_status':
      return path.endsWith('-review') ? STRANDED_STATUS : OWN_STATUS;
    case 'worktree_remote_branch_state':
      return {
        remoteAhead: 2,
        localOwn: 0,
        remoteContainsLocal: true,
        remoteSha: PR_SHA,
        localSha: BASE_SHA,
      };
    case 'worktree_list_local_branches':
      return LOCAL_BRANCHES;
    case 'worktree_list_remote_branches':
      return REMOTE_BRANCHES;
    case 'gh_run': {
      const ghArgs = argOf({ args, key: 'args' });
      const isPrList = Array.isArray(ghArgs) && ghArgs.includes('list');
      return {
        stdout: isPrList ? JSON.stringify(OPEN_PRS) : 'harborline/ledger-core',
        stderr: '',
        exitCode: 0,
      };
    }
    default:
      return null;
  }
};

export const ForeignBranchScene = ({ state = 'stranded' }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc(answer);
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: [PROJECT],
      sessions: [SESSION],
      currentSessionId: SESSION_ID,
      sessionMounts: { [SESSION_ID]: MOUNT_VIEWS },
      sessionProjectMounts: { [SESSION_ID]: PROJECT_MOUNTS },
      sessionActiveMount: { [SESSION_ID]: REVIEW_MOUNT },
      sessionActiveProject: { [SESSION_ID]: LEDGER_ID },
      sessionBranches: { [SESSION_ID]: TEAMMATE_BRANCH },
      mountBranchObservations: { [SESSION_ID]: [] },
      mountCleanupProposals: { [SESSION_ID]: [] },
      prSeries: { [SESSION_ID]: [] },
      mountGithub: {
        [REVIEW_MOUNT]: {
          pr: OPEN_PR,
          prs: [OPEN_PR],
          links: [],
          linkedIssues: [],
          fetchedAt: NOW,
          failedAt: null,
          loading: false,
          error: null,
          detail: null,
          detailFetchedAt: null,
          detailLoading: false,
          detailError: null,
          mountId: REVIEW_MOUNT,
          projectId: LEDGER_ID,
          revision: 2,
          repository: 'harborline/ledger-core',
          host: 'github.com',
          branch: TEAMMATE_BRANCH,
        },
      },
      mountGitlabMr: {},
      mountBitbucketPr: {},
      sessionWorktrees: { [SESSION_ID]: MOUNT_SEEDS.map((seed) => seed.worktreePath) },
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

  useEffect(() => {
    if (!isReady || state !== 'picker') {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click();
      window.setTimeout(
        () => document.querySelector<HTMLButtonElement>('[role="combobox"]')?.click(),
        250,
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [isReady, state]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      {state === 'picker' ? (
        <div className="flex h-full items-start justify-center pt-16">
          <div className="rounded-lg border border-border bg-popover shadow-lg">
            <BranchSwitchPanel
              sessionId={SESSION_ID}
              mountId={OWN_MOUNT}
              onDone={() => undefined}
            />
          </div>
        </div>
      ) : (
        <SessionOverviewPane session={SESSION} onSelectLens={() => undefined} />
      )}
    </main>
  );
};
