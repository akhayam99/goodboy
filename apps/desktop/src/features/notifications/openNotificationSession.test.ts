import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@goodboy/db';
import type { AgentId, SessionId, WorkspaceId } from '@goodboy/types';
import { agentPlace, sessionPlace } from '../../store/slices/navigation/place';

const { state } = vi.hoisted(() => ({
  state: {
    sessions: [] as ReadonlyArray<{ readonly id: string }>,
    workspaces: [] as ReadonlyArray<{ readonly id: string; readonly name: string }>,
    currentWorkspaceId: 'ws-1' as string | null,
    currentSessionId: null as string | null,
    navigate: vi.fn(),
    reportError: vi.fn(async () => undefined),
    openWorkspace: vi.fn(async () => undefined),
  },
}));

vi.mock('../../store', async () => {
  const useAppStore = <T>(selector: (s: typeof state) => T) => selector(state);
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { ...(await import('../../store/slices/navigation/place')), useAppStore };
});

import { openNotificationSession } from './openNotificationSession';

const buildNotification = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: 'n1',
    title: 'open session',
    coalesceKey: 'single',
    read: false,
    sessionId: 'session-1',
    ts: '2026-08-31T12:00:00.000Z',
    kind: 'error',
    body: null,
    severity: 'warning',
    workspaceId: null,
    action: null,
    ...overrides,
  }) as Notification;

beforeEach(() => {
  state.sessions = [];
  state.workspaces = [];
  state.currentWorkspaceId = 'ws-1';
  state.currentSessionId = null;
  state.navigate.mockClear();
  state.reportError.mockClear();
  state.openWorkspace.mockClear();
});

describe('openNotificationSession', () => {
  it('opens the session directly when it already belongs to this window', async () => {
    state.sessions = [{ id: 'session-1' }];
    openNotificationSession({
      notification: buildNotification({ workspaceId: 'ws-1' as WorkspaceId }),
    });

    await vi.waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: sessionPlace({ sessionId: 'session-1' as SessionId }),
      }),
    );
    expect(state.openWorkspace).not.toHaveBeenCalled();
  });

  it('opens the retry-step-summary agent directly when its session already belongs to this window', async () => {
    state.sessions = [{ id: 'session-1' }];
    openNotificationSession({
      notification: buildNotification({
        workspaceId: 'ws-1' as WorkspaceId,
        action: {
          kind: 'retry-step-summary',
          sessionId: 'session-1' as SessionId,
          agentId: 'agent-1' as AgentId,
        },
      }),
    });

    await vi.waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: agentPlace({ sessionId: 'session-1' as SessionId, agentId: 'agent-1' as AgentId }),
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
      notification: buildNotification({ workspaceId: 'ws-2' as WorkspaceId }),
    });

    await vi.waitFor(() => expect(state.openWorkspace).toHaveBeenCalledWith('ws-2', 'Northwind'));
    await vi.waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: sessionPlace({ sessionId: 'session-1' as SessionId }),
      }),
    );
  });

  it('does nothing more when openWorkspace opens another window instead of switching here', async () => {
    state.workspaces = [{ id: 'ws-2', name: 'Northwind' }];
    state.sessions = [];
    openNotificationSession({
      notification: buildNotification({ workspaceId: 'ws-2' as WorkspaceId }),
    });

    await vi.waitFor(() => expect(state.openWorkspace).toHaveBeenCalledWith('ws-2', 'Northwind'));
    expect(state.navigate).not.toHaveBeenCalled();
  });
});
