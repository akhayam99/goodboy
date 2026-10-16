import type { MonitorSnapshot } from '@goodboy/core';
import type {
  MountId,
  Project,
  ProjectId,
  Session,
  SessionExternalTask,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { brandedId } from '../../../../../../features/history/testing/brandedId';
import { trackTerminalInput } from '../../../../../../features/terminal/commandTracker';
import type { TerminalTab, TerminalTabId } from '../../../../../../shared/types/terminal';
import { useAppStore } from '../../../../../../store';
import { sceneClock } from '../../../sceneClock';
import { OVERRIDES } from '../../flow-audit/fixtures';
import { shellPromptLines, terminalIdOf, terminalSnapshotAnswer } from '../../terminalSceneOutput';
import { C13_WORKSPACE, C13_WORKSPACE_ID } from './workflowsSceneSeed';

const clock = sceneClock({ anchor: '2026-10-15T15:12:00.000Z' });
const NOW = clock.iso({ at: '2026-10-15T15:12:00.000Z' });
const CREATED_AT = clock.ms({ at: '2026-10-15T15:00:00.000Z' });
const MONITOR_AT = clock.ms({ at: '2026-10-15T15:11:00.000Z' });

export const LEDGER_SESSION_ID = brandedId<SessionId>({ value: 'mock-c13-session-ledger-export' });
const NORTHWIND_SESSION_ID = brandedId<SessionId>({ value: 'mock-c13-session-northwind' });
const PAYMENTS_ID = brandedId<ProjectId>({ value: 'mock-c13-project-payments-api' });
const LEDGER_ID = brandedId<ProjectId>({ value: 'mock-c13-project-ledger-core' });
const NOTIFY_ID = brandedId<ProjectId>({ value: 'mock-c13-project-notify-relay' });

const FOLDER = '/mock/harborline';
const PAYMENTS_ROOT = `${FOLDER}/payments-api`;
const LEDGER_ROOT = `${FOLDER}/ledger-core`;
const NOTIFY_ROOT = `${FOLDER}/notify-relay`;
export const PAYMENTS_TREE = `${PAYMENTS_ROOT}/.goodboy/worktrees/gb-7k2q9x`;
const LEDGER_TREE = `${LEDGER_ROOT}/.goodboy/worktrees/gb-4m8d1c`;
const NOTIFY_TREE = `${NOTIFY_ROOT}/.goodboy/worktrees/gb-2p6w0z`;

export const DEV_PORT = 10350;
const DEV_SHELL_PID = 4100;
const DEV_SERVER_PID = 4188;

const terminalId = (value: string): TerminalTabId => brandedId<TerminalTabId>({ value });

const WORKSPACE_TERMINAL = terminalId(`ws:${C13_WORKSPACE_ID}::t1`);
export const ZSH_TERMINAL = terminalId(`${LEDGER_SESSION_ID}::t1`);
export const DEV_TERMINAL = terminalId(`${LEDGER_SESSION_ID}::t2`);
const ZSH_TWO_TERMINAL = terminalId(`${LEDGER_SESSION_ID}::t3`);
const LEDGER_TERMINAL = terminalId(`${LEDGER_SESSION_ID}::t4`);
const NOTIFY_TERMINAL = terminalId(`${NORTHWIND_SESSION_ID}::t1`);

export const PAYMENTS_MOUNT = 'mock-c13-mount-payments';
export const LEDGER_MOUNT = 'mock-c13-mount-ledger';
const NOTIFY_MOUNT = 'mock-c13-mount-notify';

type ProjectParams = {
  readonly id: ProjectId;
  readonly name: string;
  readonly rootPath: string;
};

const projectOf = ({ id, name, rootPath }: ProjectParams): Project => ({
  id,
  workspaceId: C13_WORKSPACE_ID,
  name,
  rootPath,
  kind: 'repo',
  baseBranch: 'main',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
});

type SessionParams = {
  readonly id: SessionId;
  readonly goal: string;
};

const sessionOf = ({ id, goal }: SessionParams): Session => ({
  id,
  workspaceId: C13_WORKSPACE_ID,
  goal,
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: NOW,
  updatedAt: NOW,
});

type MountParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly worktreePath: string;
  readonly repoRoot: string;
  readonly branch: string;
};

const mountOf = ({
  id,
  sessionId,
  projectId,
  name,
  worktreePath,
  repoRoot,
  branch,
}: MountParams): SessionProjectMount => ({
  mountId: brandedId<MountId>({ value: id }),
  sessionId,
  projectId,
  mountName: name,
  worktreePath,
  lastWorktreePath: worktreePath,
  repoRoot,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

type TabParams = {
  readonly id: TerminalTabId;
  readonly owner: TerminalTab['owner'];
  readonly title: string;
  readonly cwd: string;
  readonly mountId?: string;
};

const tabOf = ({ id, owner, title, cwd, mountId }: TabParams): TerminalTab => ({
  id,
  owner,
  title,
  cwd,
  ...(mountId === undefined ? {} : { mountId: brandedId<MountId>({ value: mountId }) }),
  status: 'running',
  createdAt: CREATED_AT,
});

const LIVE = [
  { id: ZSH_TERMINAL, cwd: PAYMENTS_TREE, pid: 4090, foregroundPid: 4090 },
  { id: DEV_TERMINAL, cwd: PAYMENTS_TREE, pid: DEV_SHELL_PID, foregroundPid: DEV_SERVER_PID },
  { id: ZSH_TWO_TERMINAL, cwd: PAYMENTS_TREE, pid: 4110, foregroundPid: 4110 },
  { id: LEDGER_TERMINAL, cwd: LEDGER_TREE, pid: 4200, foregroundPid: 4200 },
  { id: NOTIFY_TERMINAL, cwd: NOTIFY_TREE, pid: 4300, foregroundPid: 4300 },
  { id: WORKSPACE_TERMINAL, cwd: FOLDER, pid: 4000, foregroundPid: 4000 },
];

const MONITOR: MonitorSnapshot = {
  listeners: [{ port: DEV_PORT, address: '127.0.0.1', protocol: 'tcp', pid: DEV_SERVER_PID }],
  processes: [
    {
      pid: DEV_SHELL_PID,
      ppid: 1,
      pgid: DEV_SHELL_PID,
      name: 'zsh',
      cwd: PAYMENTS_TREE,
      startedAt: MONITOR_AT - 480_000,
      cpuPercent: 0,
      rssBytes: 9 * 1048576,
      uid: 501,
      argsMasked: 'zsh',
    },
    {
      pid: DEV_SERVER_PID,
      ppid: DEV_SHELL_PID,
      pgid: DEV_SHELL_PID,
      name: 'node',
      cwd: PAYMENTS_TREE,
      startedAt: MONITOR_AT - 300_000,
      cpuPercent: 2.1,
      rssBytes: 142 * 1048576,
      uid: 501,
      argsMasked: 'node vite',
    },
  ],
  takenAt: MONITOR_AT,
  isPlatformSupported: true,
};

const DEV_LINES: ReadonlyArray<string> = [
  '\u001b[32m%\u001b[0m pnpm dev',
  '',
  `  Local:   http://localhost:${DEV_PORT}/`,
];

type AnswerParams = {
  readonly command: string;
  readonly payload: unknown;
};

export const terminalSceneAnswer = ({ command, payload }: AnswerParams): unknown => {
  if (command === 'terminal_list_live') {
    return LIVE;
  }
  if (command === 'terminal_snapshot') {
    const id = terminalIdOf({ payload });
    return terminalSnapshotAnswer({
      lines: id === DEV_TERMINAL ? DEV_LINES : shellPromptLines({ folder: 'harborline' }),
    });
  }
  if (command === 'worktree_changed_files') {
    return { paths: [], entries: [], additions: 117, deletions: 50, numstat: '' };
  }
  return null;
};

const ISSUE: SessionExternalTask = {
  sessionId: LEDGER_SESSION_ID,
  scope: 'session',
  provider: 'linear',
  externalId: 'mock-c13-hbl-412',
  identifier: 'HBL-412',
  url: 'https://linear.example/harborline/issue/HBL-412',
  title: 'Ledger export times out over 10k rows',
  createdAt: NOW,
};

type SeedParams = {
  readonly hasTerminals: boolean;
};

export const seedTerminalScene = ({ hasTerminals }: SeedParams): void => {
  trackTerminalInput({ terminalId: DEV_TERMINAL, data: 'pnpm dev\r' });
  const sessionOwner: TerminalTab['owner'] = { kind: 'session', sessionId: LEDGER_SESSION_ID };
  useAppStore.setState({
    workspaces: [C13_WORKSPACE],
    currentWorkspaceId: C13_WORKSPACE_ID,
    projects: [
      projectOf({ id: PAYMENTS_ID, name: 'payments-api', rootPath: PAYMENTS_ROOT }),
      projectOf({ id: LEDGER_ID, name: 'ledger-core', rootPath: LEDGER_ROOT }),
      projectOf({ id: NOTIFY_ID, name: 'notify-relay', rootPath: NOTIFY_ROOT }),
    ],
    sessions: [
      sessionOf({ id: LEDGER_SESSION_ID, goal: 'Ledger export speed up' }),
      sessionOf({ id: NORTHWIND_SESSION_ID, goal: 'Northwind webhook retries' }),
    ],
    currentSessionId: LEDGER_SESSION_ID,
    sessionProjectMounts: {
      [LEDGER_SESSION_ID]: [
        mountOf({
          id: PAYMENTS_MOUNT,
          sessionId: LEDGER_SESSION_ID,
          projectId: PAYMENTS_ID,
          name: 'payments-api',
          worktreePath: PAYMENTS_TREE,
          repoRoot: PAYMENTS_ROOT,
          branch: 'mara/ledger-export',
        }),
        mountOf({
          id: LEDGER_MOUNT,
          sessionId: LEDGER_SESSION_ID,
          projectId: LEDGER_ID,
          name: 'ledger-core',
          worktreePath: LEDGER_TREE,
          repoRoot: LEDGER_ROOT,
          branch: 'mara/ledger-export',
        }),
      ],
      [NORTHWIND_SESSION_ID]: [
        mountOf({
          id: NOTIFY_MOUNT,
          sessionId: NORTHWIND_SESSION_ID,
          projectId: NOTIFY_ID,
          name: 'notify-relay',
          worktreePath: NOTIFY_TREE,
          repoRoot: NOTIFY_ROOT,
          branch: 'tomas/retry-queue',
        }),
      ],
    },
    sessionExternalTasks: { [LEDGER_SESSION_ID]: [ISSUE], [NORTHWIND_SESSION_ID]: [] },
    terminalFolderOverrides: {},
    terminalNames: {},
    terminalTabs: hasTerminals
      ? {
          [`ws:${C13_WORKSPACE_ID}`]: [
            tabOf({
              id: WORKSPACE_TERMINAL,
              owner: { kind: 'workspace', workspaceId: C13_WORKSPACE_ID },
              title: 'zsh',
              cwd: FOLDER,
            }),
          ],
          [LEDGER_SESSION_ID]: [
            tabOf({
              id: ZSH_TERMINAL,
              owner: sessionOwner,
              title: 'zsh',
              cwd: PAYMENTS_TREE,
              mountId: PAYMENTS_MOUNT,
            }),
            tabOf({
              id: DEV_TERMINAL,
              owner: sessionOwner,
              title: 'pnpm dev',
              cwd: PAYMENTS_TREE,
              mountId: PAYMENTS_MOUNT,
            }),
            tabOf({
              id: ZSH_TWO_TERMINAL,
              owner: sessionOwner,
              title: 'zsh 2',
              cwd: PAYMENTS_TREE,
              mountId: PAYMENTS_MOUNT,
            }),
            tabOf({
              id: LEDGER_TERMINAL,
              owner: sessionOwner,
              title: 'zsh',
              cwd: LEDGER_TREE,
              mountId: LEDGER_MOUNT,
            }),
          ],
          [NORTHWIND_SESSION_ID]: [
            tabOf({
              id: NOTIFY_TERMINAL,
              owner: { kind: 'session', sessionId: NORTHWIND_SESSION_ID },
              title: 'zsh',
              cwd: NOTIFY_TREE,
              mountId: NOTIFY_MOUNT,
            }),
          ],
        }
      : {},
    activeTerminalTab: hasTerminals ? { [LEDGER_SESSION_ID]: DEV_TERMINAL } : {},
    terminalWorktreeActive: hasTerminals
      ? {
          [`${LEDGER_SESSION_ID}#m:${PAYMENTS_MOUNT}`]: DEV_TERMINAL,
          [`${LEDGER_SESSION_ID}#m:${LEDGER_MOUNT}`]: LEDGER_TERMINAL,
        }
      : {},
    terminalSelection: null,
    monitorSnapshot: hasTerminals ? MONITOR : null,
    refreshMonitorSnapshot: async () => undefined,
    loadWatchedPorts: async () => undefined,
  });
};
