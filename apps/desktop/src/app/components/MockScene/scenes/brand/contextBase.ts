import type {
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { mockWorkspace, seedShellChrome } from '../shellChrome';
import { BRAND_OTHER_SESSIONS, BRAND_PROJECTS, BRAND_SESSION, BRAND_WORKSPACE_NAME } from './canon';

const MINUTE = 60_000;

export const minutesAgo = (minutes: number): IsoDateTime =>
  new Date(Date.now() - minutes * MINUTE).toISOString() as IsoDateTime;

const CTX_WORKSPACE_ID = 'mock-brand-ctx-workspace-harborline' as WorkspaceId;
export const CTX_SESSION_ID = 'mock-brand-ctx-session-duplicate-credit' as SessionId;
export const CTX_PAYMENTS_ID = 'mock-brand-ctx-project-payments-api' as ProjectId;
const CTX_LEDGER_ID = 'mock-brand-ctx-project-ledger-core' as ProjectId;
const CTX_RELAY_ID = 'mock-brand-ctx-project-notify-relay' as ProjectId;
export const CTX_PAYMENTS_MOUNT_ID = 'mock-brand-ctx-mount-payments-api' as MountId;
const CTX_LEDGER_MOUNT_ID = 'mock-brand-ctx-mount-ledger-core' as MountId;
export const CTX_PAYMENTS_WORKTREE = '~/code/harborline/payments-api-fix-duplicate-credit';
const CTX_LEDGER_WORKTREE = '~/code/harborline/ledger-core-fix-duplicate-credit';

const WORKSPACE = mockWorkspace({ id: CTX_WORKSPACE_ID, name: BRAND_WORKSPACE_NAME });

const projectOf = (
  id: ProjectId,
  project: (typeof BRAND_PROJECTS)[keyof typeof BRAND_PROJECTS],
): Project => ({
  id,
  workspaceId: CTX_WORKSPACE_ID,
  name: project.name,
  rootPath: project.rootPath,
  kind: 'repo',
  baseBranch: 'main',
  overrides: WORKSPACE.overrides,
  createdAt: WORKSPACE.createdAt,
  updatedAt: WORKSPACE.updatedAt,
});

const CTX_PROJECTS: ReadonlyArray<Project> = [
  projectOf(CTX_PAYMENTS_ID, BRAND_PROJECTS.payments),
  projectOf(CTX_LEDGER_ID, BRAND_PROJECTS.ledger),
  projectOf(CTX_RELAY_ID, BRAND_PROJECTS.relay),
];

const mountOf = (
  mountId: MountId,
  projectId: ProjectId,
  name: string,
  worktreePath: string,
): SessionProjectMount => ({
  mountId,
  sessionId: CTX_SESSION_ID,
  projectId,
  mountName: name,
  worktreePath,
  lastWorktreePath: null,
  repoRoot: `~/code/harborline/${name}`,
  branch: BRAND_SESSION.branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 3,
});

export const CTX_MOUNTS: ReadonlyArray<SessionProjectMount> = [
  mountOf(
    CTX_PAYMENTS_MOUNT_ID,
    CTX_PAYMENTS_ID,
    BRAND_PROJECTS.payments.name,
    CTX_PAYMENTS_WORKTREE,
  ),
  mountOf(CTX_LEDGER_MOUNT_ID, CTX_LEDGER_ID, BRAND_PROJECTS.ledger.name, CTX_LEDGER_WORKTREE),
];

export const CTX_SESSION: Session = {
  id: CTX_SESSION_ID,
  workspaceId: CTX_WORKSPACE_ID,
  goal: BRAND_SESSION.title,
  state: { kind: 'idle', lastActivityAt: minutesAgo(3) },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: CTX_PAYMENTS_ID,
  activeMountId: CTX_PAYMENTS_MOUNT_ID,
  createdAt: minutesAgo(116),
  updatedAt: minutesAgo(3),
};

const SIBLING_MINUTES = [24, 70, 180, 260, 420];

const SIBLING_PROJECT: Readonly<Record<string, ProjectId>> = {
  [BRAND_PROJECTS.payments.name]: CTX_PAYMENTS_ID,
  [BRAND_PROJECTS.ledger.name]: CTX_LEDGER_ID,
  [BRAND_PROJECTS.relay.name]: CTX_RELAY_ID,
};

export const CTX_SIBLINGS: ReadonlyArray<Session> = BRAND_OTHER_SESSIONS.map((entry, index) => ({
  ...CTX_SESSION,
  id: `mock-brand-ctx-sibling-${index}` as SessionId,
  goal: entry.title,
  activeProjectId: SIBLING_PROJECT[entry.project] ?? CTX_PAYMENTS_ID,
  state: { kind: 'idle', lastActivityAt: minutesAgo(SIBLING_MINUTES[index] ?? 500) },
  updatedAt: minutesAgo(SIBLING_MINUTES[index] ?? 500),
}));

const SIBLING_BRANCHES: ReadonlyArray<string> = [
  'hl/reconcile-settlement-export',
  'hl/feat-tenant-limits',
  'hl/retire-export-cron',
  'hl/payout-hold-warning',
  'hl/nightly-reconciliation',
];

const ALL_SESSIONS: ReadonlyArray<Session> = [CTX_SESSION, ...CTX_SIBLINGS];

const BRANCHES: Readonly<Record<string, string>> = {
  [CTX_SESSION_ID]: BRAND_SESSION.branch,
  ...Object.fromEntries(
    CTX_SIBLINGS.map((sibling, index) => [sibling.id, SIBLING_BRANCHES[index] ?? 'hl/work']),
  ),
};

type SeedParams = Readonly<{
  lens: Parameters<typeof seedShellChrome>[0]['lens'];
  current?: Session;
}>;

export const seedContextBase = ({ lens, current = CTX_SESSION }: SeedParams): void => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: CTX_WORKSPACE_ID,
    projects: [...CTX_PROJECTS],
  });
  seedShellChrome({
    session: current,
    siblings: ALL_SESSIONS.filter((session) => session.id !== current.id),
    branches: BRANCHES,
    telemetryAt: minutesAgo(4),
    lens,
  });
  useAppStore.setState({
    sessionProjectMounts: { [CTX_SESSION_ID]: [...CTX_MOUNTS] },
    sessionActiveProject: { [CTX_SESSION_ID]: CTX_PAYMENTS_ID },
    sessionActiveMount: { [CTX_SESSION_ID]: CTX_PAYMENTS_MOUNT_ID },
    sessionWorktrees: { [CTX_SESSION_ID]: CTX_MOUNTS.map((mount) => mount.worktreePath) },
    sessionLoading: {
      [CTX_SESSION_ID]: {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
    },
  });
};
