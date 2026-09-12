import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { resolveActiveMountPath } from './resolveActiveMountPath';

const NOW = '2026-01-01T00:00:00.000Z' as IsoDateTime;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const API_ID = 'project-api' as ProjectId;
const WEB_ID = 'project-web' as ProjectId;
const SESSION_ID = 'session-1' as SessionId;

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  activeProjectId: API_ID,
  goal: 'test',
  state: { kind: 'draft' },
  contextSlots: [],
  providerPreference: {
    defaultProvider: 'anthropic',
    enabledProviders: ['anthropic'],
    allowTurnOverride: true,
  },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const MOUNTS: ReadonlyArray<SessionProjectMount> = [
  {
    projectId: WEB_ID,
    mountName: 'web',
    worktreePath: '/sessions/one/web',
    repoRoot: '/repo/web',
    branch: 'ak/one',
    mountId: 'mount-fixture-2' as MountId,
    sessionId: SESSION_ID,
    lastWorktreePath: null,
    baseBranch: null,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 0,
  },
  {
    projectId: API_ID,
    mountName: 'api',
    worktreePath: '/sessions/one/api',
    repoRoot: '/repo/api',
    branch: 'ak/one',
    mountId: 'mount-fixture-1' as MountId,
    sessionId: SESSION_ID,
    lastWorktreePath: null,
    baseBranch: null,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 0,
  },
];

describe('resolveActiveMountPath', () => {
  it('follows the selected mount, not the active project', () => {
    const path = resolveActiveMountPath({
      state: {
        sessions: [SESSION],
        sessionMounts: {},
        sessionActiveMount: { [SESSION_ID]: 'mount-fixture-1' as MountId },
        sessionProjectMounts: { [SESSION_ID]: MOUNTS },
        sessionActiveProject: { [SESSION_ID]: API_ID },
      },
      sessionId: SESSION_ID,
    });

    expect(path).toBe('/sessions/one/api');
  });

  it('reads the selection persisted on the session row', () => {
    const path = resolveActiveMountPath({
      state: {
        sessions: [{ ...SESSION, activeMountId: 'mount-fixture-1' as MountId }],
        sessionMounts: {},
        sessionActiveMount: {},
        sessionProjectMounts: { [SESSION_ID]: MOUNTS },
        sessionActiveProject: {},
      },
      sessionId: SESSION_ID,
    });

    expect(path).toBe('/sessions/one/api');
  });

  it('has no path while two mounts wait for a choice', () => {
    const path = resolveActiveMountPath({
      state: {
        sessions: [{ ...SESSION, activeProjectId: undefined }],
        sessionMounts: {},
        sessionActiveMount: {},
        sessionProjectMounts: { [SESSION_ID]: MOUNTS },
        sessionActiveProject: {},
      },
      sessionId: SESSION_ID,
    });

    expect(path).toBeNull();
  });

  it('recovers the only mount left when the active project is no longer mounted', () => {
    const path = resolveActiveMountPath({
      state: {
        sessions: [SESSION],
        sessionMounts: {},
        sessionActiveMount: {},
        sessionProjectMounts: { [SESSION_ID]: [MOUNTS[0] as SessionProjectMount] },
        sessionActiveProject: { [SESSION_ID]: API_ID },
      },
      sessionId: SESSION_ID,
    });

    expect(path).toBe('/sessions/one/web');
  });

  it('has no path for a session without mounts', () => {
    const path = resolveActiveMountPath({
      state: {
        sessions: [SESSION],
        sessionMounts: {},
        sessionActiveMount: {},
        sessionProjectMounts: {},
        sessionActiveProject: {},
      },
      sessionId: SESSION_ID,
    });

    expect(path).toBeNull();
  });
});
