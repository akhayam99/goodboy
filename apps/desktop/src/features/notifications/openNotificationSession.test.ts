import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessions: [] as ReadonlyArray<{ readonly id: string }>,
    workspaces: [] as ReadonlyArray<{ readonly id: string; readonly name: string }>,
    currentWorkspaceId: 'ws-1' as string | null,
    currentSessionId: null as string | null,
    setCurrentSession: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    selectAgent: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
    openWorkspace: vi.fn(async () => undefined),
  },
}));

vi.mock('../../store', () => {
  const useAppStore = <T>(selector: (s: typeof state) => T) => selector(state);
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
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
  state.setCurrentSession.mockClear();
  state.setActiveLens.mockClear();
  state.selectAgent.mockClear();
  state.reportError.mockClear();
  state.openWorkspace.mockClear();
});

describe('openNotificationSession', () => {
  it('opens the session directly when it already belongs to this window', async () => {
    state.sessions = [{ id: 'session-1' }];
    openNotificationSession({
      notification: buildNotification({ workspaceId: 'ws-1' as WorkspaceId }),
    });

    await vi.waitFor(() => expect(state.setCurrentSession).toHaveBeenCalledWith('session-1'));
    expect(state.openWorkspace).not.toHaveBeenCalled();
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
    await vi.waitFor(() => expect(state.setCurrentSession).toHaveBeenCalledWith('session-1'));
  });

  it('does nothing more when openWorkspace opens another window instead of switching here', async () => {
    state.workspaces = [{ id: 'ws-2', name: 'Northwind' }];
    state.sessions = [];
    openNotificationSession({
      notification: buildNotification({ workspaceId: 'ws-2' as WorkspaceId }),
    });

    await vi.waitFor(() => expect(state.openWorkspace).toHaveBeenCalledWith('ws-2', 'Northwind'));
    expect(state.setCurrentSession).not.toHaveBeenCalled();
  });
});
