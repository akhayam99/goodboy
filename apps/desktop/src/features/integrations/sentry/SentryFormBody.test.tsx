// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectSentry: vi.fn(async () => undefined),
    disconnectIntegration: vi.fn(async () => undefined),
    forgetIntegrationCredential: vi.fn(async () => undefined),
    integrationCredentials: [] as ReadonlyArray<unknown>,
    integrationCredentialUsage: {} as Record<string, number>,
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

const WS_ID = 'ws-1' as WorkspaceId;

const sentryIntegration = {
  id: 'wi-1',
  workspaceId: WS_ID,
  provider: 'sentry' as const,
  credentialId: 'cred-1' as IntegrationCredentialId,
  config: { org: 'my-org', project: 'my-proj', projectName: 'My Project' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const fillForm = ({ token, org, project }: { token: string; org: string; project: string }) => {
  fireEvent.change(screen.getByLabelText(/personal API key/i), { target: { value: token } });
  fireEvent.change(screen.getByLabelText(/organization slug/i), { target: { value: org } });
  fireEvent.change(screen.getByLabelText(/project slug/i), { target: { value: project } });
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectSentry = vi.fn(async () => undefined);
  state.disconnectIntegration = vi.fn(async () => undefined);
  state.forgetIntegrationCredential = vi.fn(async () => undefined);
  state.integrationCredentials = [];
  state.integrationCredentialUsage = {};
});
afterEach(cleanup);

import { SentryFormBody } from './SentryFormBody';

describe('SentryFormBody', () => {
  it('shows the token field first and the get-a-token link right under it', () => {
    render(<SentryFormBody workspaceId={WS_ID} />);

    const field = screen.getByLabelText(/personal API key/i);
    const link = screen.getByRole('link', { name: /get a user auth token/i });

    expect(field.compareDocumentPosition(link)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  describe('connect form (happy path)', () => {
    it('keeps org and project out of sight until the token is pasted', () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      expect(screen.queryByLabelText(/organization slug/i)).toBeNull();
      expect(screen.queryByLabelText(/project slug/i)).toBeNull();
      fireEvent.change(screen.getByLabelText(/personal API key/i), {
        target: { value: 'sntryu_x' },
      });
      expect(screen.getByLabelText(/organization slug/i)).toBeDefined();
      expect(screen.getByLabelText(/project slug/i)).toBeDefined();
    });

    it('keeps Connect disabled until token, org and project are all filled', () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      const btn = screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/personal API key/i), {
        target: { value: 'sntryu_x' },
      });
      expect(btn.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/organization slug/i), {
        target: { value: 'my-org' },
      });
      expect(btn.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/project slug/i), { target: { value: 'my-proj' } });
      expect(btn.disabled).toBe(false);
    });

    it('connects with all trimmed fields and fires onConnected', async () => {
      const onConnected = vi.fn();
      render(<SentryFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      fillForm({ token: '  sntryu_x  ', org: ' my-org ', project: ' my-proj ' });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      await waitFor(() =>
        expect(state.connectSentry).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          token: 'sntryu_x',
          org: 'my-org',
          project: 'my-proj',
          credentialId: null,
        }),
      );
      await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
    });

    it('shows the formatted error and skips onConnected when the connect fails', async () => {
      const onConnected = vi.fn();
      state.connectSentry = vi.fn(async () => {
        throw new Error('org not found');
      });
      render(<SentryFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      fillForm({ token: 'sntryu_x', org: 'nope', project: 'my-proj' });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      expect(await screen.findByText(/org not found/i)).toBeDefined();
      expect(onConnected).not.toHaveBeenCalled();
    });
  });

  describe('when Sentry is already connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [sentryIntegration] };
    });

    it('renders one connected row with project name, org and project', () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected to My Project/i)).toBeDefined();
      expect(screen.getByText('my-org/my-proj')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('arms the disconnect confirm instead of disconnecting immediately', () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect sentry/i }));
      expect(screen.getByText(/Disconnect Sentry\?/i)).toBeDefined();
      expect(state.disconnectIntegration).not.toHaveBeenCalled();
    });

    it('disconnects Sentry for the workspace once the confirm is confirmed', async () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect sentry/i }));
      fireEvent.click(screen.getByRole('button', { name: /^disconnect sentry$/i }));
      await waitFor(() =>
        expect(state.disconnectIntegration).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          provider: 'sentry',
        }),
      );
    });
  });

  it('keeps the keychain note behind a quiet disclosure and says where the token travels', () => {
    render(<SentryFormBody workspaceId={WS_ID} />);
    expect(screen.queryByText(/never touches Goodboy's own servers/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /where your key goes/i }));
    expect(screen.getByText(/never touches Goodboy's own servers/i)).toBeDefined();
    expect(screen.queryByText(/never leaves this machine/i)).toBeNull();
  });
});
