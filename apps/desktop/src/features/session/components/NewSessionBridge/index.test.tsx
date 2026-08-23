// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    currentWorkspaceId: null as string | null,
    projects: [] as ReadonlyArray<{ id: string; workspaceId: string }>,
    createUntitledSession: vi.fn(async () => ({ session: { id: 's-1' }, worktree: {} })),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { NewSessionBridge } from './index';

const WS_ID = 'ws-1' as WorkspaceId;

beforeEach(() => {
  state.currentWorkspaceId = WS_ID;
  state.projects = [{ id: 'p-1', workspaceId: WS_ID }];
  state.createUntitledSession.mockClear();
  state.createUntitledSession.mockResolvedValue({ session: { id: 's-1' }, worktree: {} });
  toastMock.mockReset();
});
afterEach(cleanup);

const requestNewSession = () => fireEvent(window, new CustomEvent('goodboy:new-session'));

describe('NewSessionBridge', () => {
  it('creates an untitled session instantly on the new-session event', async () => {
    render(<NewSessionBridge />);
    requestNewSession();
    await waitFor(() =>
      expect(state.createUntitledSession).toHaveBeenCalledWith({ workspaceId: WS_ID }),
    );
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('keeps the zero-projects gate: notice instead of a session', () => {
    state.projects = [];
    render(<NewSessionBridge />);
    requestNewSession();
    expect(state.createUntitledSession).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith('info', 'Link a project first, then start a session');
  });

  it('does nothing without a current workspace', () => {
    state.currentWorkspaceId = null;
    render(<NewSessionBridge />);
    requestNewSession();
    expect(state.createUntitledSession).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('surfaces a creation failure as an error toast', async () => {
    state.createUntitledSession.mockRejectedValueOnce(new Error('disk full'));
    render(<NewSessionBridge />);
    requestNewSession();
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('error', 'disk full'));
  });
});
