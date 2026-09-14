import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessions: [
      { id: 'session-1', workspaceId: 'ws-1', goal: 'ship the api', activeProjectId: 'p-api' },
    ],
    projects: [
      { id: 'p-api', name: 'api', workspaceId: 'ws-1' },
      { id: 'p-web', name: 'web', workspaceId: 'ws-1' },
      { id: 'p-data', name: 'data', workspaceId: 'ws-1' },
      { id: 'p-docs', name: 'docs', workspaceId: 'ws-1' },
    ],
    sessionProjectMounts: {} as Record<
      string,
      ReadonlyArray<{
        readonly mountId?: string;
        readonly projectId: string;
        readonly worktreePath?: string;
        readonly branch?: string;
        readonly isAttached?: boolean;
        readonly diskState?: string;
      }>
    >,
    sessionMounts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionActiveMount: {} as Record<string, string | null>,
    sessionActiveProject: {} as Record<string, string>,
    sessionSlots: {} as Record<string, ReadonlyArray<{ key: string; value: string }>>,
    sessionExternalTasks: {} as Record<string, ReadonlyArray<unknown>>,
    sessionEvents: { 'session-1': [] } as Record<string, ReadonlyArray<unknown>>,
    loadSessionEvents: vi.fn(async () => undefined),
    ensureProjectMounted: vi.fn<
      (input: { readonly projectId: string }) => Promise<{
        readonly status: 'created' | 'already-mounted';
        readonly createdMountId?: string;
        readonly mountIds: ReadonlyArray<string>;
      }>
    >(async ({ projectId }: { readonly projectId: string }) => {
      state.sessionProjectMounts = {
        ...state.sessionProjectMounts,
        'session-1': [
          ...(state.sessionProjectMounts['session-1'] ?? []),
          {
            mountId: `mount-${projectId}`,
            projectId,
            worktreePath: '/wt/api',
            branch: 'goodboy/api',
            isAttached: true,
            diskState: 'present',
          },
        ],
      };
      return {
        status: 'created' as const,
        createdMountId: `mount-${projectId}`,
        mountIds: [`mount-${projectId}`],
      };
    }),
    recordSessionEvent: vi.fn(async () => undefined),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('../workspace/window', () => ({ isMainWindow: () => false }));
vi.mock('../../store/store', () => ({
  useAppStore: { getState: () => state },
}));

import { executeMaterializeRequest } from './projectMaterializeBridge';
import { clearMaterializationBatch } from '../../store/materializationGate';

type RequestParams = {
  readonly projectId: string;
  readonly projectName: string;
  readonly runId?: string | null;
};

const request = ({ projectId, projectName, runId = 'run-1' }: RequestParams) => ({
  id: 'req-1',
  runId,
  sessionId: 'session-1' as SessionId,
  projectId: projectId as ProjectId,
  projectName,
  reason: 'needs a patch',
});

beforeEach(() => {
  clearMaterializationBatch({ sessionId: 'session-1' as SessionId, batchId: 'run-1' });
  state.sessionProjectMounts = {};
  state.sessionEvents = { 'session-1': [] };
  state.ensureProjectMounted.mockClear();
  state.loadSessionEvents.mockClear();
  state.recordSessionEvent.mockClear();
});

describe('executeMaterializeRequest', () => {
  it('mounts the first project of a session immediately', async () => {
    const result = await executeMaterializeRequest(
      request({ projectId: 'p-web', projectName: 'web' }),
    );

    expect(result).toEqual({
      ok: true,
      mountId: 'mount-p-web',
      mountPath: '/wt/api',
      branch: 'goodboy/api',
    });
    expect(state.ensureProjectMounted).toHaveBeenCalledWith({
      sessionId: 'session-1',
      projectId: 'p-web',
      reason: 'needs a patch',
    });
  });

  it('adds a second project the goal does not name', async () => {
    state.sessionProjectMounts = { 'session-1': [{ projectId: 'p-api' }] };

    const result = await executeMaterializeRequest(
      request({ projectId: 'p-web', projectName: 'web' }),
    );

    expect(result.ok).toBe(true);
    expect(state.recordSessionEvent).not.toHaveBeenCalled();
  });

  it('defers a third project the goal does not name and records the proposal', async () => {
    state.sessionProjectMounts = {
      'session-1': [{ projectId: 'p-docs' }, { projectId: 'p-other' }],
    };

    const result = await executeMaterializeRequest(
      request({ projectId: 'p-web', projectName: 'web' }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Mount deferred for web');
    expect(result.error).not.toContain('end your turn');
    expect(state.ensureProjectMounted).not.toHaveBeenCalled();
    expect(state.recordSessionEvent).toHaveBeenCalledWith({
      sessionId: 'session-1',
      kind: 'project_materialization_proposed',
      payload: {
        projectId: 'p-web',
        projectName: 'web',
        reason: 'needs a patch',
        deferralCause: 'scope',
      },
    });
  });

  it('mounts a second project the goal names', async () => {
    state.sessionProjectMounts = { 'session-1': [{ projectId: 'p-web' }] };

    const result = await executeMaterializeRequest(
      request({ projectId: 'p-api', projectName: 'api' }),
    );

    expect(result.ok).toBe(true);
    expect(state.recordSessionEvent).not.toHaveBeenCalled();
  });

  it('answers an already mounted project without a second mount', async () => {
    state.sessionProjectMounts = { 'session-1': [{ projectId: 'p-api' }] };

    const result = await executeMaterializeRequest(
      request({ projectId: 'p-api', projectName: 'api' }),
    );

    expect(result.ok).toBe(true);
    expect(state.ensureProjectMounted).toHaveBeenCalledTimes(1);
  });

  it('refuses an unknown project id', async () => {
    const result = await executeMaterializeRequest(
      request({ projectId: 'p-ghost', projectName: 'ghost' }),
    );

    expect(result).toEqual({ ok: false, error: 'unknown project: ghost' });
  });

  it('shares the immediate cap across sequential bridge commands in one turn', async () => {
    const first = await executeMaterializeRequest(
      request({ projectId: 'p-web', projectName: 'web' }),
    );
    const second = await executeMaterializeRequest(
      request({ projectId: 'p-data', projectName: 'data' }),
    );
    const third = await executeMaterializeRequest(
      request({ projectId: 'p-docs', projectName: 'docs' }),
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.error).toContain('already mounted two projects');
  });

  it('does not share a budget between bridge invocations with a blank run id', async () => {
    const first = await executeMaterializeRequest(
      request({ projectId: 'p-web', projectName: 'web', runId: '' }),
    );
    state.sessionProjectMounts = {};
    const second = await executeMaterializeRequest(
      request({ projectId: 'p-data', projectName: 'data', runId: '' }),
    );
    state.sessionProjectMounts = {};
    const third = await executeMaterializeRequest(
      request({ projectId: 'p-docs', projectName: 'docs', runId: '' }),
    );

    expect([first.ok, second.ok, third.ok]).toEqual([true, true, true]);
  });
});

describe('executeMaterializeRequest with siblings already mounted', () => {
  it('names no mount when the project already owns several', async () => {
    state.sessionProjectMounts = {
      'session-1': [
        {
          mountId: 'mount-a',
          projectId: 'p-web',
          worktreePath: '/wt/a',
          branch: 'ak/a',
          isAttached: true,
          diskState: 'present',
        },
        {
          mountId: 'mount-b',
          projectId: 'p-web',
          worktreePath: '/wt/b',
          branch: 'ak/b',
          isAttached: true,
          diskState: 'present',
        },
      ],
    };
    state.ensureProjectMounted.mockImplementationOnce(async () => ({
      status: 'already-mounted' as const,
      mountIds: ['mount-a', 'mount-b'],
    }));

    const result = await executeMaterializeRequest(
      request({ projectId: 'p-web', projectName: 'web' }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('2 branch mounts');
    expect(result.mountPath).toBeUndefined();
  });
});
