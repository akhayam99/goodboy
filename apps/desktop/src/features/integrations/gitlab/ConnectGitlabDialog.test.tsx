// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state, ghStatusMock, ghClearTokenMock } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectGitlab: vi.fn(async () => undefined),
    disconnectGitlab: vi.fn(async () => undefined),
  },
  ghStatusMock: vi.fn(async () => ({ scoped: false }) as unknown),
  ghClearTokenMock: vi.fn(async () => undefined),
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../github/github', () => ({
  ghStatus: ghStatusMock,
  ghClearToken: ghClearTokenMock,
}));

const WS_ID = 'ws-1' as WorkspaceId;

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectGitlab = vi.fn(async () => undefined);
  state.disconnectGitlab = vi.fn(async () => undefined);
  ghStatusMock.mockResolvedValue({ scoped: false });
  ghClearTokenMock.mockResolvedValue(undefined);
});
afterEach(cleanup);

import { ConnectGitlabDialog } from './ConnectGitlabDialog';

describe('ConnectGitlabDialog', () => {
  describe('when a scoped GitHub token exists for the workspace', () => {
    beforeEach(() => {
      ghStatusMock.mockResolvedValue({ scoped: true });
    });

    it('shows the mutual-exclusivity banner instead of the connect form', async () => {
      render(<ConnectGitlabDialog workspaceId={WS_ID} open onClose={vi.fn()} />);
      expect(await screen.findByText(/Disconnect GitHub to use GitLab/i)).toBeDefined();
      expect(screen.queryByLabelText(/personal access token/i)).toBeNull();
    });

    it('hides the Connect action', async () => {
      render(<ConnectGitlabDialog workspaceId={WS_ID} open onClose={vi.fn()} />);
      await screen.findByText(/Disconnect GitHub to use GitLab/i);
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('wires the Disconnect GitHub button to ghClearToken', async () => {
      render(<ConnectGitlabDialog workspaceId={WS_ID} open onClose={vi.fn()} />);
      const btn = await screen.findByRole('button', { name: /disconnect github/i });
      fireEvent.click(btn);
      await waitFor(() => expect(ghClearTokenMock).toHaveBeenCalledWith(WS_ID));
    });
  });

  describe('when GitHub is not scoped for the workspace', () => {
    it('renders the host and token form with a Connect action', async () => {
      render(<ConnectGitlabDialog workspaceId={WS_ID} open onClose={vi.fn()} />);
      await waitFor(() => expect(ghStatusMock).toHaveBeenCalledWith(WS_ID));
      expect(screen.getByLabelText(/^host$/i)).toBeDefined();
      expect(screen.getByLabelText(/personal access token/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /^connect$/i })).toBeDefined();
      expect(screen.queryByText(/Disconnect GitHub to use GitLab/i)).toBeNull();
    });
  });
});
