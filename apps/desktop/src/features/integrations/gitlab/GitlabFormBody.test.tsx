// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  GitlabIntegrationBinding,
  IntegrationCredentialId,
  WorkspaceId,
} from '@goodboy/types';

const { state, ghStatusMock, ghClearTokenMock } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectGitlab: vi.fn(async () => undefined),
    disconnectIntegration: vi.fn(async () => undefined),
    forgetIntegrationCredential: vi.fn(async () => undefined),
    integrationCredentials: [] as ReadonlyArray<unknown>,
    integrationCredentialUsage: {} as Record<string, number>,
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

const gitlabIntegration: GitlabIntegrationBinding = {
  id: 'wi-1' as never,
  workspaceId: WS_ID,
  projectId: null,
  provider: 'gitlab',
  credentialId: 'cred-1' as IntegrationCredentialId,
  config: { userName: 'octo', userId: '42', host: 'https://gitlab.example.com' },
  createdAt: '2026-01-01T00:00:00.000Z' as never,
  updatedAt: '2026-01-01T00:00:00.000Z' as never,
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectGitlab = vi.fn(async () => undefined);
  state.disconnectIntegration = vi.fn(async () => undefined);
  state.forgetIntegrationCredential = vi.fn(async () => undefined);
  state.integrationCredentials = [];
  state.integrationCredentialUsage = {};
  ghStatusMock.mockResolvedValue({ scoped: false });
  ghClearTokenMock.mockResolvedValue(undefined);
});
afterEach(cleanup);

import { GitlabFormBody } from './GitlabFormBody';

const openHostDisclosure = () => {
  fireEvent.click(screen.getByRole('button', { name: /self-hosted gitlab/i }));
};

describe('GitlabFormBody', () => {
  it('shows the token field first and the get-a-token link right under it', () => {
    render(<GitlabFormBody workspaceId={WS_ID} />);

    const field = screen.getByLabelText(/personal API key/i);
    const link = screen.getByRole('link', { name: /get a personal access token/i });

    expect(field.compareDocumentPosition(link)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(link.getAttribute('href')).toBe('https://gitlab.com/-/profile/personal_access_tokens');
  });

  describe('connect form (happy path)', () => {
    it('disables Connect until a non-empty token is entered', () => {
      render(<GitlabFormBody workspaceId={WS_ID} />);
      const btn = screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/personal API key/i), {
        target: { value: 'glpat-x' },
      });
      expect(btn.disabled).toBe(false);
    });

    it('keeps the host behind a quiet disclosure and connects with the default host', async () => {
      const onConnected = vi.fn();
      render(<GitlabFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      expect(screen.queryByLabelText(/^host$/i)).toBeNull();
      fireEvent.change(screen.getByLabelText(/personal API key/i), {
        target: { value: ' glpat-x ' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      await waitFor(() =>
        expect(state.connectGitlab).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          host: 'https://gitlab.com',
          token: 'glpat-x',
          credentialId: null,
        }),
      );
      await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
    });

    it('normalizes a scheme-less host and strips trailing slashes before connecting', async () => {
      render(<GitlabFormBody workspaceId={WS_ID} />);
      openHostDisclosure();
      fireEvent.change(screen.getByLabelText(/^host$/i), {
        target: { value: 'gitlab.example.com/' },
      });
      fireEvent.change(screen.getByLabelText(/personal API key/i), {
        target: { value: 'glpat-x' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      await waitFor(() =>
        expect(state.connectGitlab).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          host: 'https://gitlab.example.com',
          token: 'glpat-x',
          credentialId: null,
        }),
      );
    });

    it('falls back to the default host when a non-http(s) scheme is supplied', async () => {
      render(<GitlabFormBody workspaceId={WS_ID} />);
      openHostDisclosure();
      fireEvent.change(screen.getByLabelText(/^host$/i), {
        target: { value: 'javascript://evil.example.com' },
      });
      fireEvent.change(screen.getByLabelText(/personal API key/i), {
        target: { value: 'glpat-x' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      await waitFor(() =>
        expect(state.connectGitlab).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          host: 'https://gitlab.com',
          token: 'glpat-x',
          credentialId: null,
        }),
      );
    });

    it('points the get-a-token link at the self-hosted instance once one is set', () => {
      render(<GitlabFormBody workspaceId={WS_ID} />);
      openHostDisclosure();
      fireEvent.change(screen.getByLabelText(/^host$/i), {
        target: { value: 'gitlab.example.com' },
      });
      const link = screen.getByRole('link', { name: /get a personal access token/i });
      expect(link.getAttribute('href')).toBe(
        'https://gitlab.example.com/-/profile/personal_access_tokens',
      );
    });

    it('shows the formatted error and skips onConnected when the connect fails', async () => {
      const onConnected = vi.fn();
      state.connectGitlab = vi.fn(async () => {
        throw new Error('invalid token');
      });
      render(<GitlabFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      fireEvent.change(screen.getByLabelText(/personal API key/i), {
        target: { value: 'glpat-bad' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      expect(await screen.findByText(/invalid token/i)).toBeDefined();
      expect(onConnected).not.toHaveBeenCalled();
    });
  });

  describe('when GitLab is already connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [gitlabIntegration] };
    });

    it('renders one connected row with user and host', async () => {
      render(<GitlabFormBody workspaceId={WS_ID} />);
      expect(await screen.findByText(/Connected as octo/i)).toBeDefined();
      expect(screen.getByText('https://gitlab.example.com')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('arms the disconnect confirm instead of disconnecting immediately', async () => {
      render(<GitlabFormBody workspaceId={WS_ID} />);
      fireEvent.click(await screen.findByRole('button', { name: /disconnect gitlab/i }));
      expect(await screen.findByText(/Disconnect GitLab\?/i)).toBeDefined();
      expect(state.disconnectIntegration).not.toHaveBeenCalled();
    });

    it('disconnects GitLab for the workspace once the confirm is confirmed', async () => {
      render(<GitlabFormBody workspaceId={WS_ID} />);
      fireEvent.click(await screen.findByRole('button', { name: /disconnect gitlab/i }));
      fireEvent.click(await screen.findByRole('button', { name: /^disconnect gitlab$/i }));
      await waitFor(() =>
        expect(state.disconnectIntegration).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          provider: 'gitlab',
        }),
      );
    });
  });

  describe('when a scoped GitHub token exists', () => {
    beforeEach(() => {
      ghStatusMock.mockResolvedValue({ scoped: true });
    });

    it('offers the connect form and no cross-host disconnect so both hosts coexist', async () => {
      render(<GitlabFormBody workspaceId={WS_ID} />);
      expect(await screen.findByLabelText(/personal API key/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /^connect$/i })).toBeDefined();
      expect(screen.queryByText(/Disconnect GitHub/i)).toBeNull();
    });

    it('never reads or clears the GitHub token', async () => {
      render(<GitlabFormBody workspaceId={WS_ID} />);
      fireEvent.change(await screen.findByLabelText(/personal API key/i), {
        target: { value: 'glpat-x' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      await waitFor(() =>
        expect(state.connectGitlab).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          host: 'https://gitlab.com',
          token: 'glpat-x',
          credentialId: null,
        }),
      );
      expect(ghStatusMock).not.toHaveBeenCalled();
      expect(ghClearTokenMock).not.toHaveBeenCalled();
    });
  });

  it('does not claim the token never leaves this machine', () => {
    render(<GitlabFormBody workspaceId={WS_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /where your key goes/i }));
    expect(screen.getByText(/never touches Goodboy's own servers/i)).toBeDefined();
    expect(screen.queryByText(/never leaves this machine/i)).toBeNull();
  });
});
