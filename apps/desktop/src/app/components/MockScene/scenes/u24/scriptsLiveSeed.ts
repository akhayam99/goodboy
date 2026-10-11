import type { MonitorSnapshot } from '@goodboy/core';
import type {
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionMountView,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { parseScriptPins } from '../../../../../features/scripts/parseScriptPins';
import { scriptPinId } from '../../../../../features/scripts/scriptPinId';
import { scriptPinsKey } from '../../../../../features/scripts/scriptPinsKey';
import {
  discoveredScriptId,
  type ScriptGroup,
  type ScriptRunRecord,
} from '../../../../../features/scripts/scripts';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { mockWorkspace } from '../shellChrome';

export type ScriptsLiveVariant = 'idle' | 'running' | 'portbusy' | 'suggested';

type NameParams = {
  readonly name: string;
};

type VariantParams = {
  readonly variant: ScriptsLiveVariant;
};

type MountViewParams = {
  readonly mount: SessionProjectMount;
};

type MountParams = {
  readonly mountId: MountId;
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly branch: string;
};

type SessionParams = {
  readonly id: SessionId;
  readonly goal: string;
};

type CommandParams = {
  readonly command: string;
};

type TickParams = {
  readonly tick: number;
};

type IdParams = {
  readonly value: string;
};

const hasMockPrefix = <Id extends string>(value: string): value is Id => value.startsWith('mock-');

const idOf = <Id extends string>({ value }: IdParams): Id => {
  if (!hasMockPrefix<Id>(value)) {
    throw new Error(`Not a mock id: ${value}`);
  }
  return value;
};

export const SCRIPTS_LIVE_WORKSPACE_ID = idOf<WorkspaceId>({ value: 'mock-sl-workspace' });
export const SCRIPTS_LIVE_SESSION_ID = idOf<SessionId>({ value: 'mock-sl-session' });
const OTHER_SESSION_ID = idOf<SessionId>({ value: 'mock-sl-session-other' });
const PROJECT_ID = idOf<ProjectId>({ value: 'mock-sl-project-payments' });
const MOUNT_ID = idOf<MountId>({ value: 'mock-sl-mount' });
const OTHER_MOUNT_ID = idOf<MountId>({ value: 'mock-sl-mount-other' });

const WORKTREE = '/mock/harborline/payments-api-settlement';
const OTHER_WORKTREE = '/mock/harborline/payments-api-rounding';
const ROOT = '/mock/harborline/payments-api';

const clock = sceneClock({ anchor: '2026-10-11T09:00:00.000Z' });
const NOW = clock.iso({ at: '2026-10-11T09:00:00.000Z' });
const DEV_RUN_ID = 'mock-sl-run-dev';
const DEV_PID = 4242;
const DEV_PORT = 5005;

const DEV_LINES: ReadonlyArray<string> = [
  'vite v6.0.2 ready in 312 ms',
  'GET /v1/ledger/batches 200 in 18 ms',
  'GET /v1/ledger/batches/b-4417 200 in 9 ms',
  'POST /v1/settlements/replay 202 in 41 ms',
  'hmr update /src/routes/settlements.ts',
];

const GROUP: ScriptGroup = {
  source: 'package-json',
  packageName: 'payments-api',
  relDir: '',
  manager: 'pnpm',
  scripts: [
    { name: 'dev', command: 'pnpm run dev', body: `vite --port ${DEV_PORT}` },
    { name: 'preview', command: 'pnpm run preview', body: 'vite preview --port 4173' },
    { name: 'build', command: 'pnpm run build', body: 'tsc -b && vite build' },
    { name: 'test', command: 'pnpm run test', body: 'vitest run' },
    { name: 'lint', command: 'pnpm run lint', body: 'eslint .' },
    { name: 'typecheck', command: 'pnpm run typecheck', body: 'tsc --noEmit' },
  ],
};

const keyOf = ({ name }: NameParams): string =>
  discoveredScriptId({ worktreePath: WORKTREE, source: GROUP.source, relDir: '', name });

const pinIdOf = ({ name }: NameParams): string =>
  scriptPinId({ source: GROUP.source, relDir: '', name, savedId: null });

const PINNED = ['dev', 'preview', 'build', 'test', 'lint'];

const runsFor = ({ variant }: VariantParams) => {
  const mountId = MOUNT_ID;
  const base: Record<string, ScriptRunRecord> = {
    [keyOf({ name: 'test' })]: {
      status: 'ok',
      result: { stdout: ' Tests  914 passed (914)\n', stderr: '', exitCode: 0 },
      runId: 'mock-sl-run-test',
      startedAt: clock.ms({ at: '2026-10-11T08:56:35.600Z' }),
      completedAt: clock.ms({ at: '2026-10-11T08:56:48.000Z' }),
      name: 'test',
      mountId,
    },
    [keyOf({ name: 'build' })]: {
      status: 'error',
      result: {
        stdout:
          "src/routes/settlements.ts(41,9): error TS2322: Type 'string' is not assignable to type 'number'.\n",
        stderr: '',
        exitCode: 1,
      },
      runId: 'mock-sl-run-build',
      startedAt: clock.ms({ at: '2026-10-11T08:51:00.000Z' }),
      completedAt: clock.ms({ at: '2026-10-11T08:51:07.000Z' }),
      name: 'build',
      mountId,
    },
    [keyOf({ name: 'preview' })]: {
      status: 'error',
      result: { stdout: 'preview ready\nKilled\n', stderr: '', exitCode: 137 },
      runId: 'mock-sl-run-preview',
      startedAt: clock.ms({ at: '2026-10-11T08:40:00.000Z' }),
      completedAt: clock.ms({ at: '2026-10-11T08:48:00.000Z' }),
      name: 'preview',
      mountId,
    },
  };
  if (variant === 'running') {
    return {
      ...base,
      [keyOf({ name: 'dev' })]: {
        status: 'pending',
        result: null,
        runId: DEV_RUN_ID,
        startedAt: clock.ms({ at: '2026-10-11T08:58:48.000Z' }),
        name: 'dev',
        mountId,
        output: `${DEV_LINES[0]}\n`,
      } satisfies ScriptRunRecord,
    };
  }
  if (variant === 'suggested') {
    return {};
  }
  return base;
};

const project = (): Project => ({
  id: PROJECT_ID,
  workspaceId: SCRIPTS_LIVE_WORKSPACE_ID,
  name: 'payments-api',
  rootPath: ROOT,
  kind: 'repo',
  baseBranch: 'main',
  overrides: mockWorkspace({ id: SCRIPTS_LIVE_WORKSPACE_ID, name: 'Harborline' }).overrides,
  createdAt: NOW,
  updatedAt: NOW,
});

const mountOf = ({
  mountId,
  sessionId,
  worktreePath,
  branch,
}: MountParams): SessionProjectMount => ({
  mountId,
  sessionId,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath,
  lastWorktreePath: null,
  repoRoot: ROOT,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const viewOf = ({ mount }: MountViewParams): SessionMountView => ({
  id: mount.mountId,
  sessionId: mount.sessionId,
  projectId: mount.projectId,
  worktreePath: mount.worktreePath,
  lastWorktreePath: null,
  branch: mount.branch,
  baseBranch: mount.baseBranch,
  parallelIndex: mount.parallelIndex,
  mountName: mount.mountName,
  repoSlug: null,
  repoRoot: mount.repoRoot,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: NOW,
  updatedAt: NOW,
});

const sessionOf = ({ id, goal }: SessionParams): Session => ({
  id,
  workspaceId: SCRIPTS_LIVE_WORKSPACE_ID,
  goal,
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
});

const snapshotFor = ({ variant }: VariantParams): MonitorSnapshot => {
  const takenAt = clock.ms({ at: '2026-10-11T09:00:00.000Z' });
  if (variant === 'running') {
    return {
      listeners: [{ port: DEV_PORT, address: '127.0.0.1', protocol: 'tcp', pid: DEV_PID + 1 }],
      processes: [
        {
          pid: DEV_PID,
          ppid: 1,
          pgid: DEV_PID,
          name: 'pnpm',
          cwd: WORKTREE,
          startedAt: takenAt - 72_000,
          cpuPercent: 0.4,
          rssBytes: 62 * 1048576,
          uid: 501,
          argsMasked: 'pnpm run dev',
        },
        {
          pid: DEV_PID + 1,
          ppid: DEV_PID,
          pgid: DEV_PID,
          name: 'node',
          cwd: WORKTREE,
          startedAt: takenAt - 71_000,
          cpuPercent: 3.2,
          rssBytes: 148 * 1048576,
          uid: 501,
          argsMasked: 'node vite',
        },
      ],
      takenAt,
      isPlatformSupported: true,
    };
  }
  if (variant === 'portbusy') {
    return {
      listeners: [{ port: DEV_PORT, address: '127.0.0.1', protocol: 'tcp', pid: 9000 }],
      processes: [
        {
          pid: 9000,
          ppid: 1,
          pgid: 9000,
          name: 'node',
          cwd: OTHER_WORKTREE,
          startedAt: takenAt - 600_000,
          cpuPercent: 1,
          rssBytes: 120 * 1048576,
          uid: 501,
          argsMasked: 'node vite',
        },
      ],
      takenAt,
      isPlatformSupported: true,
    };
  }
  return { listeners: [], processes: [], takenAt, isPlatformSupported: true };
};

const noop = () => undefined;

export const seedScriptsLive = ({ variant }: VariantParams): void => {
  const mount = mountOf({
    mountId: MOUNT_ID,
    sessionId: SCRIPTS_LIVE_SESSION_ID,
    worktreePath: WORKTREE,
    branch: 'hl/settlement-batch',
  });
  const other = mountOf({
    mountId: OTHER_MOUNT_ID,
    sessionId: OTHER_SESSION_ID,
    worktreePath: OTHER_WORKTREE,
    branch: 'hl/ledger-rounding',
  });
  const pinsKey = scriptPinsKey({ projectId: PROJECT_ID });
  const pins = variant === 'suggested' ? [] : PINNED.map((name) => pinIdOf({ name }));
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, [pinsKey]: JSON.stringify(pins) },
    loadScriptPins: async () => undefined,
    toggleScriptPin: async ({ projectId, pinId }) => {
      const key = scriptPinsKey({ projectId });
      const current = parseScriptPins({ raw: useAppStore.getState().settings[key] });
      const next = current.includes(pinId)
        ? current.filter((entry) => entry !== pinId)
        : [...current, pinId];
      useAppStore.setState((state) => ({
        settings: { ...state.settings, [key]: JSON.stringify(next) },
      }));
    },
    workspaces: [mockWorkspace({ id: SCRIPTS_LIVE_WORKSPACE_ID, name: 'Harborline' })],
    currentWorkspaceId: SCRIPTS_LIVE_WORKSPACE_ID,
    projects: [project()],
    sessions: [
      sessionOf({ id: SCRIPTS_LIVE_SESSION_ID, goal: 'Replay the stuck settlement batch' }),
      sessionOf({ id: OTHER_SESSION_ID, goal: 'Fix ledger rounding' }),
    ],
    currentSessionId: SCRIPTS_LIVE_SESSION_ID,
    sessionProjectMounts: { [SCRIPTS_LIVE_SESSION_ID]: [mount], [OTHER_SESSION_ID]: [other] },
    sessionMounts: {
      [SCRIPTS_LIVE_SESSION_ID]: [viewOf({ mount })],
      [OTHER_SESSION_ID]: [viewOf({ mount: other })],
    },
    sessionActiveMount: { [SCRIPTS_LIVE_SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SCRIPTS_LIVE_SESSION_ID]: PROJECT_ID },
    projectScripts: { [SCRIPTS_LIVE_WORKSPACE_ID]: [] },
    scriptRuns: { [SCRIPTS_LIVE_SESSION_ID]: runsFor({ variant }) },
    discoveredScripts: { [SCRIPTS_LIVE_SESSION_ID]: { [WORKTREE]: [GROUP] } },
    discoveredScriptScans: {
      [SCRIPTS_LIVE_SESSION_ID]: { [WORKTREE]: { status: 'ready', error: null } },
    },
    scriptsLensScope: null,
    monitorSnapshot: snapshotFor({ variant }),
    monitorLedger: [],
    monitorScanned: {
      [PROJECT_ID]: [{ port: DEV_PORT, label: 'dev', source: 'script', relDir: '' }],
    },
    monitorWatched: {},
    monitorLearned: {},
    loadWatchedPorts: async () => undefined,
    refreshMonitorSnapshot: async () => undefined,
    loadScripts: async () => undefined,
    saveScript: async () => undefined,
    deleteScript: async () => undefined,
    cancelScript: async () => undefined,
    loadDiscoveredScripts: async () => undefined,
    refreshDiscoveredScripts: async () => undefined,
    setScriptsLensScope: noop,
    navigate: () => undefined,
  });
};

export const scriptsLiveInvoke = ({ command }: CommandParams): unknown => {
  if (command === 'workspace_script_list_live') {
    return [
      {
        runId: DEV_RUN_ID,
        scriptId: keyOf({ name: 'dev' }),
        name: 'dev',
        sessionId: SCRIPTS_LIVE_SESSION_ID,
        pid: DEV_PID,
        startedAt: clock.ms({ at: '2026-10-11T08:58:48.000Z' }),
      },
    ];
  }
  return null;
};

export const advanceDevOutput = ({ tick }: TickParams): void => {
  const key = keyOf({ name: 'dev' });
  const line = DEV_LINES[tick % DEV_LINES.length] ?? DEV_LINES[0];
  useAppStore.setState((state) => {
    const run = state.scriptRuns[SCRIPTS_LIVE_SESSION_ID]?.[key];
    if (run === undefined || run.status !== 'pending') {
      return {};
    }
    return {
      scriptRuns: {
        ...state.scriptRuns,
        [SCRIPTS_LIVE_SESSION_ID]: {
          ...state.scriptRuns[SCRIPTS_LIVE_SESSION_ID],
          [key]: { ...run, output: `${DEV_LINES[0]}\n${line}\n` },
        },
      },
    };
  });
};
