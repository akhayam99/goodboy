import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  Session,
  SessionId,
  SessionMount,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { resolveSessionRepo } from './resolveSessionRepo';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const API_WORKSPACE_ID = 'workspace-api' as WorkspaceId;
const WEB_WORKSPACE_ID = 'workspace-web' as WorkspaceId;
const STALE_WORKSPACE_ID = 'workspace-stale' as WorkspaceId;
const NOW = '2026-08-01T00:00:00.000Z' as IsoDateTime;

const SESSION = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Ship project scope',
  state: { kind: 'draft' },
  contextSlots: [],
  providerPreference: {
    defaultProvider: 'anthropic',
    allowTurnOverride: true,
  },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
} satisfies Session;

const API_MOUNT = {
  workspaceId: API_WORKSPACE_ID,
  mountName: 'api',
  worktreePath: '/worktrees/session-1/api',
  repoRoot: '/repos/api',
  branch: 'ak/project-scope',
} satisfies SessionMount;

const WEB_MOUNT = {
  workspaceId: WEB_WORKSPACE_ID,
  mountName: 'web',
  worktreePath: '/worktrees/session-1/web',
  repoRoot: '/repos/web',
  branch: 'ak/project-scope',
} satisfies SessionMount;

type State = Parameters<typeof resolveSessionRepo>[0]['state'];

type StateParams = {
  readonly workspace: Workspace;
  readonly sessions?: ReadonlyArray<Session>;
  readonly mounts?: ReadonlyArray<SessionMount>;
  readonly activeMount?: WorkspaceId;
  readonly worktrees?: ReadonlyArray<string>;
  readonly branch?: string;
};

const buildState = ({
  workspace,
  sessions = [SESSION],
  mounts = [],
  activeMount,
  worktrees = [],
  branch,
}: StateParams): State => ({
  sessions,
  workspaces: [workspace],
  sessionMounts: { [SESSION_ID]: mounts },
  sessionActiveMount: activeMount == null ? {} : { [SESSION_ID]: activeMount },
  sessionWorktrees: { [SESSION_ID]: worktrees },
  sessionBranches: branch == null ? {} : { [SESSION_ID]: branch },
});

type WorkspaceParams = {
  readonly kind?: Workspace['kind'];
};

const buildWorkspace = ({ kind }: WorkspaceParams): Workspace => ({
  id: WORKSPACE_ID,
  name: 'Project',
  rootPath: '/repos/project',
  ...(kind == null ? {} : { kind }),
  createdAt: NOW,
  updatedAt: NOW,
});

describe('resolveSessionRepo', () => {
  it('resolves repo workspaces from the primary session worktree', () => {
    const expected = {
      repoRoot: '/repos/project',
      worktreePath: '/worktrees/session-1',
      branch: 'ak/project-scope',
      mountName: null,
      workspaceId: WORKSPACE_ID,
    };
    const repoResult = resolveSessionRepo({
      state: buildState({
        workspace: buildWorkspace({ kind: 'repo' }),
        worktrees: ['/worktrees/session-1', '/worktrees/session-1-secondary'],
        branch: 'ak/project-scope',
      }),
      sessionId: SESSION_ID,
    });
    const legacyResult = resolveSessionRepo({
      state: buildState({
        workspace: buildWorkspace({}),
        worktrees: ['/worktrees/session-1'],
        branch: 'ak/project-scope',
      }),
      sessionId: SESSION_ID,
    });

    expect(repoResult).toEqual(expected);
    expect(legacyResult).toEqual(expected);
  });

  it('returns null for a simple workspace', () => {
    const result = resolveSessionRepo({
      state: buildState({
        workspace: buildWorkspace({ kind: 'simple' }),
        worktrees: ['/sessions/session-1'],
        branch: '',
      }),
      sessionId: SESSION_ID,
    });

    expect(result).toBeNull();
  });

  it('uses the first composite mount when no active mount is explicit', () => {
    const result = resolveSessionRepo({
      state: buildState({
        workspace: buildWorkspace({ kind: 'composite' }),
        mounts: [API_MOUNT, WEB_MOUNT],
        worktrees: ['/worktrees/session-1', API_MOUNT.worktreePath, WEB_MOUNT.worktreePath],
        branch: API_MOUNT.branch,
      }),
      sessionId: SESSION_ID,
    });

    expect(result).toEqual({ ...API_MOUNT });
  });

  it('uses the explicit active composite mount', () => {
    const result = resolveSessionRepo({
      state: buildState({
        workspace: buildWorkspace({ kind: 'composite' }),
        mounts: [API_MOUNT, WEB_MOUNT],
        activeMount: WEB_WORKSPACE_ID,
      }),
      sessionId: SESSION_ID,
    });

    expect(result).toEqual({ ...WEB_MOUNT });
  });

  it('falls back to the first composite mount when the active mount id is stale', () => {
    const result = resolveSessionRepo({
      state: buildState({
        workspace: buildWorkspace({ kind: 'composite' }),
        mounts: [API_MOUNT, WEB_MOUNT],
        activeMount: STALE_WORKSPACE_ID,
      }),
      sessionId: SESSION_ID,
    });

    expect(result).toEqual({ ...API_MOUNT });
  });

  it('returns null when the session is missing', () => {
    const result = resolveSessionRepo({
      state: buildState({
        workspace: buildWorkspace({ kind: 'repo' }),
        sessions: [],
        worktrees: ['/worktrees/session-1'],
        branch: 'ak/project-scope',
      }),
      sessionId: SESSION_ID,
    });

    expect(result).toBeNull();
  });
});
