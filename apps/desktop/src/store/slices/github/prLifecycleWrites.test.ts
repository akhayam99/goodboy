import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  run: vi.fn(async (_args: ReadonlyArray<string>, _opts: unknown) => ({
    exitCode: 0,
    stdout: '',
    stderr: '',
  })),
}));

vi.mock('../../../features/github/github', () => ({ tauriGhRunner: { run: h.run } }));

import { markPrReady } from './markPrReady';
import { mergePr } from './mergePr';

const SESSION_ID = 'session-1' as SessionId;
const LEDGER_ID = 'project-ledger' as ProjectId;
const RELAY_ID = 'project-relay' as ProjectId;
const LEDGER_MOUNT_ID = 'mount-ledger' as MountId;
const RELAY_MOUNT_ID = 'mount-relay' as MountId;

type State = Record<string, unknown>;

const mount = ({
  mountId,
  projectId,
  name,
  parallelIndex,
}: {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly parallelIndex: number;
}) => ({
  mountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: name,
  worktreePath: `/worktrees/${name}`,
  lastWorktreePath: `/worktrees/${name}`,
  repoRoot: `/repos/${name}`,
  branch: `ak/${name}`,
  baseBranch: null,
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const makeState = (): State => ({
  sessions: [
    {
      id: SESSION_ID,
      workspaceId: 'workspace-1',
      activeMountId: LEDGER_MOUNT_ID,
      activeProjectId: LEDGER_ID,
    },
  ],
  workspaces: [{ id: 'workspace-1' }],
  projects: [
    { id: LEDGER_ID, workspaceId: 'workspace-1', kind: 'repo', name: 'ledger-core' },
    { id: RELAY_ID, workspaceId: 'workspace-1', kind: 'repo', name: 'notify-relay' },
  ],
  sessionActiveMount: { [SESSION_ID]: LEDGER_MOUNT_ID },
  sessionActiveProject: { [SESSION_ID]: LEDGER_ID },
  sessionMounts: {},
  sessionProjectMounts: {
    [SESSION_ID]: [
      mount({
        mountId: LEDGER_MOUNT_ID,
        projectId: LEDGER_ID,
        name: 'ledger-core',
        parallelIndex: 0,
      }),
      mount({
        mountId: RELAY_MOUNT_ID,
        projectId: RELAY_ID,
        name: 'notify-relay',
        parallelIndex: 0,
      }),
    ],
  },
  sessionGithub: {
    [SESSION_ID]: { pr: { number: 12, title: 'Ledger change', url: 'https://example.test/12' } },
  },
  mountGithub: {
    [RELAY_MOUNT_ID]: {
      pr: null,
      prs: [{ number: 44, title: 'Relay change', url: 'https://example.test/44' }],
    },
  },
  claimPrWrite: vi.fn(() => ({ ok: true, token: 'token-1' })),
  releasePrWrite: vi.fn(),
  emitNotification: vi.fn(async () => undefined),
  refreshSessionPr: vi.fn(async () => undefined),
  recordSessionEventOnce: vi.fn(async () => undefined),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.run.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
});

describe('pull request writes with two mounts', () => {
  it('marks the pull request ready in the mount it names, not the active one', async () => {
    const state = makeState();

    await markPrReady(vi.fn(), (() => state) as never)(SESSION_ID, 44, {
      mountId: RELAY_MOUNT_ID,
    });

    expect(h.run).toHaveBeenCalledWith(['pr', 'ready', '44'], {
      cwd: '/repos/notify-relay',
      workspaceId: 'workspace-1',
      projectId: RELAY_ID,
    });
    expect(state.claimPrWrite).toHaveBeenCalledWith({
      projectId: RELAY_ID,
      prNumber: 44,
      action: 'ready',
    });
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      force: true,
      mountId: RELAY_MOUNT_ID,
    });
    expect(state.recordSessionEventOnce).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'pr_ready',
      payload: { number: 44, title: 'Relay change', url: 'https://example.test/44' },
    });
  });

  it('merges the pull request in the mount it names, not the active one', async () => {
    const state = makeState();

    await mergePr(vi.fn(), (() => state) as never)(SESSION_ID, 44, 'rebase', {
      mountId: RELAY_MOUNT_ID,
    });

    expect(h.run).toHaveBeenCalledWith(['pr', 'merge', '44', '--rebase'], {
      cwd: '/repos/notify-relay',
      workspaceId: 'workspace-1',
      projectId: RELAY_ID,
    });
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      force: true,
      mountId: RELAY_MOUNT_ID,
    });
  });

  it('keeps the active mount when no mount is named', async () => {
    const state = makeState();

    await mergePr(vi.fn(), (() => state) as never)(SESSION_ID, 12);

    expect(h.run).toHaveBeenCalledWith(['pr', 'merge', '12', '--squash'], {
      cwd: '/repos/ledger-core',
      workspaceId: 'workspace-1',
      projectId: LEDGER_ID,
    });
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, { force: true });
  });
});
