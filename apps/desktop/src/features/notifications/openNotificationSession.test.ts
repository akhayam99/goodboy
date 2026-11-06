// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { agentPlace, branchPlace, sessionPlace } from '../../store/slices/navigation/place';

const { state } = vi.hoisted(() => {
  const nullable = <T>(value: T | null): T | null => value;
  return {
    state: {
      sessions: Array.of<{ readonly id: string }>(),
      archivedSessions: Object.fromEntries(
        Array.of<[string, ReadonlyArray<{ readonly id: string }>]>(),
      ),
      workspaces: Array.of<{ readonly id: string; readonly name: string }>(),
      currentWorkspaceId: nullable('ws-1'),
      currentSessionId: nullable<string>(null),
      navigate: vi.fn(),
      reportError: vi.fn(async () => undefined),
      openWorkspace: vi.fn(async () => undefined),
      refreshReviewSource: vi.fn(async () => undefined),
      loadDiffComments: vi.fn(async () => undefined),
      loadResolveSession: vi.fn(async () => undefined),
    },
  };
});

vi.mock('../../store', async () => {
  const useAppStore = <T>(selector: (s: typeof state) => T) => selector(state);
  Object.assign(useAppStore, { getState: () => state });
  return { ...(await import('../../store/slices/navigation/place')), useAppStore };
});

import { ATTENTION_HANDLED_EVENT } from '../session/attentionHandledEvent';
import { attentionTargetChannel } from '../session/attentionTargetChannel';
import { openNotificationSession } from './openNotificationSession';

const HARBORLINE = brandId<WorkspaceId>({ value: 'ws-1' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'ws-2' });
const SESSION_ONE = brandId<SessionId>({ value: 'session-1' });
const AGENT_ONE = brandId<AgentId>({ value: 'agent-1' });
const PAYMENTS_MOUNT = brandId<MountId>({ value: 'mount-payments-api' });

const buildNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'n1',
  title: 'open session',
  coalesceKey: 'single',
  read: false,
  sessionId: SESSION_ONE,
  ts: brandId<IsoDateTime>({ value: '2026-08-31T12:00:00.000Z' }),
  kind: 'error',
  body: null,
  severity: 'warning',
  workspaceId: null,
  action: null,
  actedAt: null,
  ...overrides,
});

beforeEach(() => {
  state.sessions = [];
  state.archivedSessions = {};
  state.workspaces = [];
  state.currentWorkspaceId = 'ws-1';
  state.currentSessionId = null;
  state.navigate.mockClear();
  state.reportError.mockClear();
  state.openWorkspace.mockReset();
  attentionTargetChannel.take({ workspaceId: 'ws-2', now: Date.now() });
});

describe('openNotificationSession', () => {
  it('opens the session directly when it already belongs to this window', async () => {
    state.sessions = [{ id: 'session-1' }];
    openNotificationSession({
      notification: buildNotification({ workspaceId: HARBORLINE }),
    });

    await vi.waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: sessionPlace({ sessionId: SESSION_ONE }),
      }),
    );
    expect(state.openWorkspace).not.toHaveBeenCalled();
  });

  it('opens the retry-step-summary agent directly when its session already belongs to this window', async () => {
    state.sessions = [{ id: 'session-1' }];
    openNotificationSession({
      notification: buildNotification({
        workspaceId: HARBORLINE,
        action: {
          kind: 'retry-step-summary',
          sessionId: SESSION_ONE,
          agentId: AGENT_ONE,
        },
      }),
    });

    await vi.waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: agentPlace({ sessionId: SESSION_ONE, agentId: AGENT_ONE }),
      }),
    );
  });

  it('lands on the Checks tab of the branch an open-place notification names', async () => {
    state.sessions = [{ id: 'session-1' }];
    Object.assign(state, {
      sessionProjectMounts: {
        'session-1': [
          {
            mountId: 'mount-payments-api',
            worktreePath: '/work/payments-api',
            lastWorktreePath: null,
          },
        ],
      },
    });
    openNotificationSession({
      notification: buildNotification({
        workspaceId: HARBORLINE,
        action: {
          kind: 'open-place',
          sessionId: SESSION_ONE,
          reason: 'ci-failed',
          mountId: PAYMENTS_MOUNT,
        },
      }),
    });

    await vi.waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: branchPlace({
          sessionId: SESSION_ONE,
          mountPath: '/work/payments-api',
          tab: 'checks',
        }),
      }),
    );
  });

  it('falls back to the session for an old notification with no action', async () => {
    state.sessions = [{ id: 'session-1' }];
    openNotificationSession({
      notification: buildNotification({ workspaceId: HARBORLINE, action: null }),
    });

    await vi.waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: sessionPlace({ sessionId: SESSION_ONE }),
      }),
    );
  });

  it('routes through openWorkspace instead of stopping agents in this window', async () => {
    state.workspaces = [{ id: 'ws-2', name: 'Northwind' }];
    state.sessions = [{ id: 'session-1' }];
    state.openWorkspace.mockImplementation(async () => {
      state.currentWorkspaceId = 'ws-2';
    });
    openNotificationSession({
      notification: buildNotification({ workspaceId: NORTHWIND }),
    });

    await vi.waitFor(() =>
      expect(state.openWorkspace).toHaveBeenCalledWith({
        id: 'ws-2',
        title: 'Northwind',
        onRunning: 'new-window',
      }),
    );
    await vi.waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: sessionPlace({ sessionId: SESSION_ONE }),
      }),
    );
  });

  it('leaves the place for the window that shows the other workspace, never navigates here', async () => {
    state.workspaces = [{ id: 'ws-2', name: 'Northwind' }];
    state.sessions = [];
    openNotificationSession({
      notification: buildNotification({ workspaceId: NORTHWIND }),
    });

    await vi.waitFor(() =>
      expect(state.openWorkspace).toHaveBeenCalledWith({
        id: 'ws-2',
        title: 'Northwind',
        onRunning: 'new-window',
      }),
    );
    expect(state.navigate).not.toHaveBeenCalled();
    expect(attentionTargetChannel.take({ workspaceId: 'ws-2', now: Date.now() })).toEqual({
      workspaceId: 'ws-2',
      sessionId: 'session-1',
      reason: null,
      agentId: null,
    });
  });

  it('says Already handled and opens an archived session', async () => {
    state.archivedSessions = { 'ws-1': [{ id: 'session-1' }] };
    const handled = vi.fn();
    globalThis.addEventListener(ATTENTION_HANDLED_EVENT, handled);
    openNotificationSession({ notification: buildNotification({ workspaceId: HARBORLINE }) });

    await vi.waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: sessionPlace({ sessionId: SESSION_ONE }),
      }),
    );
    expect(handled).toHaveBeenCalledOnce();
    globalThis.removeEventListener(ATTENTION_HANDLED_EVENT, handled);
  });

  it('says Already handled and opens the session for a place of an archived session', async () => {
    state.archivedSessions = { 'ws-1': [{ id: 'session-1' }] };
    const handled = vi.fn();
    globalThis.addEventListener(ATTENTION_HANDLED_EVENT, handled);
    openNotificationSession({
      notification: buildNotification({
        workspaceId: HARBORLINE,
        action: {
          kind: 'open-place',
          sessionId: SESSION_ONE,
          reason: 'ci-failed',
          mountId: PAYMENTS_MOUNT,
        },
      }),
    });

    await vi.waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: sessionPlace({ sessionId: SESSION_ONE }),
      }),
    );
    expect(handled).toHaveBeenCalledOnce();
    globalThis.removeEventListener(ATTENTION_HANDLED_EVENT, handled);
  });

  it('says Already handled and moves nowhere when the session is gone', async () => {
    const handled = vi.fn();
    globalThis.addEventListener(ATTENTION_HANDLED_EVENT, handled);
    openNotificationSession({ notification: buildNotification({ workspaceId: HARBORLINE }) });

    await vi.waitFor(() => expect(handled).toHaveBeenCalledOnce());
    expect(state.navigate).not.toHaveBeenCalled();
    globalThis.removeEventListener(ATTENTION_HANDLED_EVENT, handled);
  });
});
