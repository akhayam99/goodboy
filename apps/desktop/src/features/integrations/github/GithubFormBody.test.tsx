// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  GitlabIntegrationBinding,
  IntegrationCredentialId,
  ProjectId,
  WorkspaceId,
} from '@goodboy/types';

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
const PROJECT_ID = 'project-1' as ProjectId;

const gitlabIntegration: GitlabIntegrationBinding = {
  id: 'wi-1' as never,
  workspaceId: WS_ID,
  projectId: null,
  provider: 'gitlab',
  credentialId: 'cred-1' as IntegrationCredentialId,
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
  it('offers the token link before the token field', async () => {
    render(<GithubFormBody workspaceId={WS_ID} />);

    const link = await screen.findByRole('link', { name: /create a personal access token/i });
    const field = screen.getByLabelText(/GitHub personal API key/i);

    expect(link.compareDocumentPosition(field)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  describe('token form (happy path)', () => {
    it('only focuses the token field when the containing surface opts in', async () => {
      const view = render(<GithubFormBody workspaceId={WS_ID} />);
      const inlineField = await screen.findByLabelText(/GitHub personal API key/i);
      expect(inlineField).not.toBe(document.activeElement);

      view.unmount();
      render(<GithubFormBody workspaceId={WS_ID} shouldAutoFocus />);
      expect(await screen.findByLabelText(/GitHub personal API key/i)).toBe(document.activeElement);
    });

    it('queries gh status for the workspace on mount', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      await waitFor(() => expect(ghStatusMock).toHaveBeenCalledWith(WS_ID));
    });

    it('disables Connect until a non-empty token is entered', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      const btn = (await screen.findByRole('button', { name: /^connect$/i })) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/GitHub personal API key/i), {
        target: { value: 'ghp_abc' },
      });
      expect(btn.disabled).toBe(false);
    });

    it('keeps Connect disabled for a whitespace-only token', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      await screen.findByLabelText(/GitHub personal API key/i);
      fireEvent.change(screen.getByLabelText(/GitHub personal API key/i), {
        target: { value: '   ' },
      });
      expect(
        (screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('sets the trimmed token and fires onConnected on a successful connect', async () => {
      const onConnected = vi.fn();
      render(<GithubFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      fireEvent.change(await screen.findByLabelText(/GitHub personal API key/i), {
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
      fireEvent.change(await screen.findByLabelText(/GitHub personal API key/i), {
        target: { value: 'ghp_bad' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      expect(await screen.findByText(/bad credentials/i)).toBeDefined();
      expect(onConnected).not.toHaveBeenCalled();
    });

    it('renders the rejection it is handed without decorating it', async () => {
      ghSetTokenMock.mockRejectedValueOnce(
        'GitHub rejected this personal API key. Check you pasted the whole value, then try again.',
      );
      render(<GithubFormBody workspaceId={WS_ID} />);
      fireEvent.change(await screen.findByLabelText(/GitHub personal API key/i), {
        target: { value: 'ghp_bad' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));

      const box = await screen.findByText(/GitHub rejected this personal API key/);
      expect(box.textContent).toBe(
        'GitHub rejected this personal API key. Check you pasted the whole value, then try again.',
      );
    });

    it('keeps each rejection cause distinguishable in the danger box', async () => {
      const causes = [
        'GitHub rejected this personal API key. Check you pasted the whole value, then try again.',
        'This personal API key has expired or was revoked. Create a new one on GitHub and paste it here.',
        'This personal API key is missing the access Goodboy needs. Recreate it with the repo scope, and authorize it for your org if SSO is on.',
        'Goodboy cannot reach github.com. Check your connection, then try again.',
      ];
      const shown: string[] = [];
      for (const cause of causes) {
        ghSetTokenMock.mockRejectedValueOnce(cause);
        const view = render(<GithubFormBody workspaceId={WS_ID} />);
        fireEvent.change(await screen.findByLabelText(/GitHub personal API key/i), {
          target: { value: 'ghp_bad' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
        shown.push((await screen.findByText(cause)).textContent ?? '');
        view.unmount();
      }

      expect(shown).toEqual(causes);
      expect(new Set(shown).size).toBe(4);
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

    it('arms the disconnect confirm instead of clearing the token immediately', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      fireEvent.click(await screen.findByRole('button', { name: /^disconnect$/i }));
      expect(await screen.findByText(/Disconnect GitHub\?/i)).toBeDefined();
      expect(ghClearTokenMock).not.toHaveBeenCalled();
    });

    it('clears the token for the workspace once the confirm is confirmed', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      fireEvent.click(await screen.findByRole('button', { name: /^disconnect$/i }));
      fireEvent.click(await screen.findByRole('button', { name: /^disconnect github$/i }));
      await waitFor(() => expect(ghClearTokenMock).toHaveBeenCalledWith(WS_ID));
    });
  });

  describe('when GitLab is connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [gitlabIntegration] };
    });

    it('still offers the token form so both hosts can coexist', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      expect(await screen.findByLabelText(/GitHub personal API key/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /^connect$/i })).toBeDefined();
      expect(screen.queryByText(/Disconnect GitLab/i)).toBeNull();
    });

    it('connects GitHub without touching the GitLab integration', async () => {
      render(<GithubFormBody workspaceId={WS_ID} />);
      fireEvent.change(await screen.findByLabelText(/GitHub personal API key/i), {
        target: { value: 'ghp_abc' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      await waitFor(() => expect(ghSetTokenMock).toHaveBeenCalledWith('ghp_abc', WS_ID));
      expect(state.disconnectGitlab).not.toHaveBeenCalled();
    });
  });

  it('does not claim the token never leaves this machine', async () => {
    render(<GithubFormBody workspaceId={WS_ID} />);
    await screen.findByLabelText(/GitHub personal API key/i);
    expect(screen.queryByText(/never leaves this machine/i)).toBeNull();
  });
});
