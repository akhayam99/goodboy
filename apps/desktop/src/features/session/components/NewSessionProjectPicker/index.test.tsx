// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    pendingProjectPickWorkspaceId: null as string | null,
    projects: [] as ReadonlyArray<{ id: string; workspaceId: string; name: string; kind: string }>,
    createUntitledSession: vi.fn(async () => ({ session: { id: 's-1' } })),
    clearSessionProjectPick: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { NewSessionProjectPicker } from './index';

const WS_ID = 'ws-1' as WorkspaceId;

beforeEach(() => {
  state.pendingProjectPickWorkspaceId = WS_ID;
  state.projects = [
    { id: 'p-api', workspaceId: WS_ID, name: 'api', kind: 'repo' },
    { id: 'p-web', workspaceId: WS_ID, name: 'web', kind: 'repo' },
  ];
  state.createUntitledSession.mockClear();
  state.createUntitledSession.mockResolvedValue({ session: { id: 's-1' } });
  state.clearSessionProjectPick.mockClear();
});
afterEach(cleanup);

describe('NewSessionProjectPicker', () => {
  it('stays out of the way until a pick is pending', () => {
    state.pendingProjectPickWorkspaceId = null;
    const { container } = render(<NewSessionProjectPicker workspaceId={WS_ID} />);
    expect(container.firstChild).toBeNull();
  });

  it('creates the session in the picked project and closes', async () => {
    render(<NewSessionProjectPicker workspaceId={WS_ID} />);

    fireEvent.click(screen.getByText('web'));

    await waitFor(() =>
      expect(state.createUntitledSession).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        projectId: 'p-web',
      }),
    );
    await waitFor(() => expect(state.clearSessionProjectPick).toHaveBeenCalled());
  });

  it('keeps the pick open and says why when the worktree cannot be created', async () => {
    state.createUntitledSession.mockRejectedValueOnce(new Error('git worktree add failed'));
    render(<NewSessionProjectPicker workspaceId={WS_ID} />);

    fireEvent.click(screen.getByText('api'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('git worktree add failed');
    expect(state.clearSessionProjectPick).not.toHaveBeenCalled();
  });

  it('cancels back to the board without creating anything', () => {
    render(<NewSessionProjectPicker workspaceId={WS_ID} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(state.createUntitledSession).not.toHaveBeenCalled();
    expect(state.clearSessionProjectPick).toHaveBeenCalled();
  });
});
