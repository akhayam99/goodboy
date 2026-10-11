import type {
  LedgerRow,
  MonitorListener,
  MonitorProcess,
  MonitorSnapshot,
  WatchedPort,
} from '@goodboy/core';
import type {
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionMountView,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });
const NOW_ISO = clock.iso({ at: '2026-10-10T09:12:00.000Z' });
export const TAKEN_AT = clock.ms({ at: '2026-10-10T09:12:00.000Z' });

export const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'mock-u24-workspace-harborline' });
export const SESSION_ID = brandedId<SessionId>({ value: 'mock-u24-session-credit' });
export const OTHER_SESSION_ID = brandedId<SessionId>({ value: 'mock-u24-session-refunds' });
export const THIRD_SESSION_ID = brandedId<SessionId>({ value: 'mock-u24-session-audit' });
export const PAYMENTS_ID = brandedId<ProjectId>({ value: 'mock-u24-project-payments-api' });
export const LEDGER_ID = brandedId<ProjectId>({ value: 'mock-u24-project-ledger-core' });
export const NOTIFY_ID = brandedId<ProjectId>({ value: 'mock-u24-project-notify-relay' });

const FOLDER = '/mock/harborline';
const PAYMENTS_ROOT = `${FOLDER}/payments-api`;
const LEDGER_ROOT = `${FOLDER}/ledger-core`;
const NOTIFY_ROOT = `${FOLDER}/notify-relay`;
const PAYMENTS_TREE = '/mock/worktrees/hl-fix-duplicate-credit/payments-api';
const PAYMENTS_TREE_B = '/mock/worktrees/hl-refund-rounding/payments-api';
const PAYMENTS_TREE_C = '/mock/worktrees/hl-audit-trail/payments-api';

export const BRANCH_A = 'hl/fix-duplicate-credit';

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

export const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
};

type ProjectParams = {
  readonly id: ProjectId;
  readonly name: string;
  readonly rootPath: string;
  readonly isStarred?: boolean;
};

const projectOf = ({ id, name, rootPath, isStarred = false }: ProjectParams): Project => ({
  id,
  workspaceId: WORKSPACE_ID,
  name,
  rootPath,
  kind: 'repo',
  baseBranch: 'main',
  overrides: OVERRIDES,
  ...(isStarred ? { starredAt: NOW_ISO } : {}),
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
});

export const PROJECTS: ReadonlyArray<Project> = [
  projectOf({ id: PAYMENTS_ID, name: 'payments-api', rootPath: PAYMENTS_ROOT, isStarred: true }),
  projectOf({ id: LEDGER_ID, name: 'ledger-core', rootPath: LEDGER_ROOT }),
  projectOf({ id: NOTIFY_ID, name: 'notify-relay', rootPath: NOTIFY_ROOT }),
];

type SessionParams = {
  readonly id: SessionId;
  readonly goal: string;
};

const sessionOf = ({ id, goal }: SessionParams): Session => ({
  id,
  workspaceId: WORKSPACE_ID,
  goal,
  state: { kind: 'idle', lastActivityAt: NOW_ISO },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
});

export const SESSIONS: ReadonlyArray<Session> = [
  sessionOf({ id: SESSION_ID, goal: 'Stop duplicate credits on retried payments' }),
  sessionOf({ id: OTHER_SESSION_ID, goal: 'Round refund totals to minor units' }),
  sessionOf({ id: THIRD_SESSION_ID, goal: 'Add an audit trail to payouts' }),
];

type MountParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly branch: string;
};

const mountOf = ({ id, sessionId, worktreePath, branch }: MountParams): SessionMountView => ({
  id: brandedId<MountId>({ value: id }),
  sessionId,
  projectId: PAYMENTS_ID,
  worktreePath,
  lastWorktreePath: worktreePath,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'payments-api',
  repoSlug: 'harborline/payments-api',
  repoRoot: PAYMENTS_ROOT,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
});

export const SESSION_MOUNTS: Readonly<Record<string, ReadonlyArray<SessionMountView>>> = {
  [SESSION_ID]: [
    mountOf({
      id: 'mock-u24-mount-credit',
      sessionId: SESSION_ID,
      worktreePath: PAYMENTS_TREE,
      branch: BRANCH_A,
    }),
  ],
  [OTHER_SESSION_ID]: [
    mountOf({
      id: 'mock-u24-mount-refunds',
      sessionId: OTHER_SESSION_ID,
      worktreePath: PAYMENTS_TREE_B,
      branch: 'hl/refund-rounding',
    }),
  ],
  [THIRD_SESSION_ID]: [
    mountOf({
      id: 'mock-u24-mount-audit',
      sessionId: THIRD_SESSION_ID,
      worktreePath: PAYMENTS_TREE_C,
      branch: 'hl/audit-trail',
    }),
  ],
};

type ProcessParams = {
  readonly pid: number;
  readonly name: string;
  readonly cwd: string | null;
  readonly args: string;
  readonly ageMs: number;
  readonly cpuPercent: number;
  readonly rssMb: number;
};

const processOf = ({
  pid,
  name,
  cwd,
  args,
  ageMs,
  cpuPercent,
  rssMb,
}: ProcessParams): MonitorProcess => ({
  pid,
  ppid: 1,
  pgid: pid,
  name,
  cwd,
  startedAt: TAKEN_AT - ageMs,
  cpuPercent,
  rssBytes: rssMb * 1024 * 1024,
  uid: 501,
  argsMasked: args,
});

const MINUTE = 60_000;

const PROCESSES: ReadonlyArray<MonitorProcess> = [
  processOf({
    pid: 4100,
    name: 'node',
    cwd: PAYMENTS_TREE,
    args: 'node server.js --port 5005 --token=***',
    ageMs: 42 * MINUTE,
    cpuPercent: 1.4,
    rssMb: 212,
  }),
  processOf({
    pid: 4200,
    name: 'vite',
    cwd: LEDGER_ROOT,
    args: 'vite --port 3000',
    ageMs: 3 * 60 * MINUTE,
    cpuPercent: 0.3,
    rssMb: 148,
  }),
  processOf({
    pid: 300,
    name: 'ControlCenter',
    cwd: '/System/Library',
    args: 'ControlCenter',
    ageMs: 5 * 24 * 60 * MINUTE,
    cpuPercent: 0,
    rssMb: 64,
  }),
  processOf({
    pid: 5101,
    name: 'claude',
    cwd: PAYMENTS_TREE_B,
    args: 'claude -p --model claude-sonnet-5-5',
    ageMs: 9 * MINUTE,
    cpuPercent: 4.2,
    rssMb: 310,
  }),
  processOf({
    pid: 5102,
    name: 'claude',
    cwd: PAYMENTS_TREE_C,
    args: 'claude -p --model claude-sonnet-5-5',
    ageMs: 4 * MINUTE,
    cpuPercent: 3.1,
    rssMb: 288,
  }),
];

const LISTENERS: ReadonlyArray<MonitorListener> = [
  { port: 5005, address: '127.0.0.1', protocol: 'tcp', pid: 4100 },
  { port: 3000, address: '127.0.0.1', protocol: 'tcp', pid: 4200 },
  { port: 7000, address: '*', protocol: 'tcp', pid: 300 },
];

export const SNAPSHOT: MonitorSnapshot = {
  listeners: LISTENERS,
  processes: PROCESSES,
  takenAt: TAKEN_AT,
  isPlatformSupported: true,
};

export const EMPTY_SNAPSHOT: MonitorSnapshot = {
  listeners: [],
  processes: [],
  takenAt: TAKEN_AT,
  isPlatformSupported: true,
};

export const LEDGER: ReadonlyArray<LedgerRow> = [
  {
    spawnId: 'mock-u24-spawn-refunds',
    kind: 'turn',
    pid: 5101,
    pgid: 5101,
    sessionId: OTHER_SESSION_ID,
    mountPath: PAYMENTS_TREE_B,
    cwd: PAYMENTS_TREE_B,
    startedAt: TAKEN_AT - 9 * MINUTE,
  },
  {
    spawnId: 'mock-u24-spawn-audit',
    kind: 'turn',
    pid: 5102,
    pgid: 5102,
    sessionId: THIRD_SESSION_ID,
    mountPath: PAYMENTS_TREE_C,
    cwd: PAYMENTS_TREE_C,
    startedAt: TAKEN_AT - 4 * MINUTE,
  },
];

export const SCANNED: Readonly<Record<string, ReadonlyArray<WatchedPort>>> = {
  [PAYMENTS_ID]: [
    { port: 5005, label: 'web', source: 'env' },
    { port: 5002, label: 'blog', source: 'vite' },
  ],
  [LEDGER_ID]: [],
  [NOTIFY_ID]: [],
};

export const NO_SCANNED: Readonly<Record<string, ReadonlyArray<WatchedPort>>> = {
  [PAYMENTS_ID]: [],
  [LEDGER_ID]: [],
  [NOTIFY_ID]: [],
};
