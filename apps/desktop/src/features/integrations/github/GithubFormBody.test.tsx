// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GitlabWorkspaceIntegration, WorkspaceId } from '@goodboy/types';

const { state, ghStatusMock, ghSetTokenMock, ghClearTokenMock } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    disconnectGitlab: vi.fn(async () => undefined),
  },
  ghStatusMock: vi.fn(async () => ({ scoped: false, user: null }) as unknown),
  ghSetTokenMock: vi.fn(async () => ({ scoped: true }) as unknown),
  ghClearTokenMock: vi.fn(async () => undefined),
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../github/github', () => ({
  ghStatus: ghStatusMock,
  ghSetToken: ghSetTokenMock,
  ghClearToken: ghClearTokenMock,
}));

const WS_ID = 'ws-1' as WorkspaceId;

const gitlabIntegration: GitlabWorkspaceIntegration = {
  id: 'wi-1' as never,
  workspaceId: WS_ID,
  provider: 'gitlab',
  credentialKey: 'cred-1',
  config: { userName: 'octo', userId: '42', host: 'https://gitlab.com' },
  createdAt: '2026-01-01T00:00:00.000Z' as never,
  updatedAt: '2026-01-01T00:00:00.000Z' as never,
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.disconnectGitlab = vi.fn(async () => undefined);
  ghStatusMock.mockResolvedValue({ scoped: false, user: null });
  ghSetTokenMock.mockResolvedValue({ scoped: true });
  ghClearTokenMock.mockResolvedValue(undefined);
});
afterEach(cleanup);

import { GithubFormBody } from './GithubFormBody';

describe('GithubFormBody', () => {
  describe('token form (happy path)', () => {
    it('only focuses the token field when the containing surface opts in', async () => {
      const view = render(<GithubFormBody workspaceId={WS_ID} />);
      const inlineField = await screen.findByLabelText(/GitHub personal access token/i);
      expect(inlineField).not.toBe(document.activeElement);

      view.unmount();
      render(<GithubFormBody workspaceId={WS_ID} shouldAutoFocus />);
      expect(await screen.findByLabelText(/GitHub personal access token/i)).toBe(
        document.activeElement,
      );
    });

    it('queries gh status for the workspace on mount', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      await waitFor(() => expect(ghStatusMock).toHaveBeenCalledWith(WS_ID));
    });

    it('disables Connect until a non-empty token is entered', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      const btn = (await screen.findByRole('button', { name: /^connect$/i })) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/GitHub personal access token/i), {
        target: { value: 'ghp_abc' },
      });
      expect(btn.disabled).toBe(false);
    });

    it('keeps Connect disabled for a whitespace-only token', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      await screen.findByLabelText(/GitHub personal access token/i);
      fireEvent.change(screen.getByLabelText(/GitHub personal access token/i), {
        target: { value: '   ' },
      });
      expect(
        (screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('sets the trimmed token and fires onConnected on a successful connect', async () => {
      const onConnected = vi.fn();
      render(<GithubFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      fireEvent.change(await screen.findByLabelText(/GitHub personal access token/i), {
        target: { value: '  ghp_abc  ' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      await waitFor(() => expect(ghSetTokenMock).toHaveBeenCalledWith('ghp_abc', WS_ID));
      await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
    });

    it('shows the formatted error and skips onConnected when the connect fails', async () => {
      const onConnected = vi.fn();
      ghSetTokenMock.mockRejectedValueOnce(new Error('bad credentials'));
      render(<GithubFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      fireEvent.change(await screen.findByLabelText(/GitHub personal access token/i), {
        target: { value: 'ghp_bad' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      expect(await screen.findByText(/bad credentials/i)).toBeDefined();
      expect(onConnected).not.toHaveBeenCalled();
    });
  });

  describe('when a scoped token is already connected', () => {
    beforeEach(() => {
      ghStatusMock.mockResolvedValue({ scoped: true, user: 'octocat' });
    });

    it('renders the connected state with the gh user', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      expect(await screen.findByText(/Connected as octocat/i)).toBeDefined();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('clears the token for the workspace on Disconnect', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      fireEvent.click(await screen.findByRole('button', { name: /^disconnect$/i }));
      await waitFor(() => expect(ghClearTokenMock).toHaveBeenCalledWith(WS_ID));
    });
  });

  describe('when GitLab is connected (mutual exclusivity)', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [gitlabIntegration] };
    });

    it('shows the mutex banner and no token form', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      expect(await screen.findByText(/Disconnect GitLab to use a GitHub token/i)).toBeDefined();
      expect(screen.queryByLabelText(/GitHub personal access token/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('disconnects GitLab when the banner action is clicked', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      fireEvent.click(await screen.findByRole('button', { name: /disconnect gitlab/i }));
      expect(state.disconnectGitlab).toHaveBeenCalledWith(WS_ID);
    });
  });
});
