// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    currentWorkspaceId: null as string | null,
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
  state.createUntitledSession.mockClear();
  state.createUntitledSession.mockResolvedValue({ session: { id: 's-1' }, worktree: {} });
  toastMock.mockReset();
});
afterEach(cleanup);

const requestNewSession = () => fireEvent(window, new CustomEvent('goodboy:new-session'));

describe('NewSessionBridge', () => {
  it('creates the session immediately, with no project attached', async () => {
    render(<NewSessionBridge />);
    requestNewSession();
    await waitFor(() =>
      expect(state.createUntitledSession).toHaveBeenCalledWith({ workspaceId: WS_ID }),
    );
    expect(toastMock).not.toHaveBeenCalled();
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
