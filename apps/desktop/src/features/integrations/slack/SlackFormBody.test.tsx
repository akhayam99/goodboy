// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IntegrationCredentialId, SlackIntegrationBinding, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectSlack: vi.fn(async () => undefined),
    disconnectIntegration: vi.fn(async () => undefined),
    forgetIntegrationCredential: vi.fn(async () => undefined),
    integrationCredentials: [] as ReadonlyArray<unknown>,
    integrationCredentialUsage: {} as Record<string, number>,
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

const { openUrl } = vi.hoisted(() => ({ openUrl: vi.fn(async () => undefined) }));

vi.mock('../../../shared/lib/editor', () => ({ openUrl }));

const WS_ID = 'ws-1' as WorkspaceId;

const slackIntegration: SlackIntegrationBinding = {
  id: 'wi-1' as never,
  workspaceId: WS_ID,
  projectId: null,
  provider: 'slack',
  credentialId: 'cred-1' as IntegrationCredentialId,
  config: {
    teamId: 'T01',
    teamName: 'Acme',
    botUserId: 'U09',
    botUserName: 'goodboy',
  },
  createdAt: '2026-01-01T00:00:00.000Z' as never,
  updatedAt: '2026-01-01T00:00:00.000Z' as never,
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectSlack = vi.fn(async () => undefined);
  state.disconnectIntegration = vi.fn(async () => undefined);
  state.forgetIntegrationCredential = vi.fn(async () => undefined);
  state.integrationCredentials = [];
  state.integrationCredentialUsage = {};
  openUrl.mockClear();
});
afterEach(cleanup);

import { SlackFormBody } from './SlackFormBody';
import { buildSlackManifestUrl, SLACK_USER_SCOPES } from './slackAppManifest';

describe('SlackFormBody', () => {
  it('walks the setup one step at a time before the token field', () => {
    render(<SlackFormBody workspaceId={WS_ID} />);

    const firstStep = screen.getByRole('button', { name: /open Slack with the scopes filled in/i });
    const field = screen.getByLabelText(/user token/i);

    expect(firstStep.compareDocumentPosition(field)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('Step 1 of 3')).toBeDefined();
    expect(screen.queryByText(/Copy the User OAuth Token/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /create a Slack app/i })).toBeNull();
  });

  it('opens Slack through the app rather than a raw anchor', () => {
    render(<SlackFormBody workspaceId={WS_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /open Slack with the scopes filled in/i }));
    expect(openUrl).toHaveBeenCalledWith(buildSlackManifestUrl({ userScopes: SLACK_USER_SCOPES }));
  });

  it('keeps Connect disabled until a token is pasted', () => {
    render(<SlackFormBody workspaceId={WS_ID} />);
    const connect = screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement;
    expect(connect.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/user token/i), { target: { value: ' xoxp-secret ' } });
    expect(connect.disabled).toBe(false);
  });

  it('trims the pasted token before connecting', async () => {
    const onConnected = vi.fn();
    render(<SlackFormBody workspaceId={WS_ID} onConnected={onConnected} />);
    fireEvent.change(screen.getByLabelText(/user token/i), { target: { value: ' xoxp-secret ' } });
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    await waitFor(() =>
      expect(state.connectSlack).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        botToken: 'xoxp-secret',
        credentialId: null,
      }),
    );
    await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
  });

  it('keeps the scope list behind a quiet disclosure and names every scope there', () => {
    render(<SlackFormBody workspaceId={WS_ID} />);
    expect(screen.queryByText('channels:read')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /what Goodboy does with the token/i }));
    expect(screen.getByText('channels:read')).toBeDefined();
    expect(screen.getByText('channels:history')).toBeDefined();
    expect(screen.getByText('users:read')).toBeDefined();
    expect(screen.getByText('chat:write')).toBeDefined();
    expect(screen.getByText('reactions:write')).toBeDefined();
    expect(screen.getByText(/never touches Goodboy's own servers/i)).toBeDefined();
    expect(screen.queryByText(/never leaving this machine/i)).toBeNull();
  });

  it('promises the channels you are in and says replies go out under your name', () => {
    render(<SlackFormBody workspaceId={WS_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /what Goodboy does with the token/i }));
    expect(screen.getByText(/public channels you have joined/i)).toBeDefined();
    expect(screen.getByText(/under your own name/i)).toBeDefined();
    expect(screen.queryByText(/the bot has joined/i)).toBeNull();
    expect(screen.queryByText(/Public channels only/i)).toBeNull();
  });

  it('shows the failure and skips onConnected when the probe is rejected', async () => {
    const onConnected = vi.fn();
    state.connectSlack = vi.fn(async () => {
      throw new Error('slack rejected the token');
    });
    render(<SlackFormBody workspaceId={WS_ID} onConnected={onConnected} />);
    fireEvent.change(screen.getByLabelText(/user token/i), { target: { value: 'xoxp-bad' } });
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    expect(await screen.findByText(/slack rejected the token/i)).toBeDefined();
    expect(onConnected).not.toHaveBeenCalled();
  });

  describe('when Slack is already connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [slackIntegration] };
    });

    it('names the person the token belongs to, never a bot', () => {
      render(<SlackFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected to Acme/i)).toBeDefined();
      expect(screen.getByText('as goodboy')).toBeDefined();
      expect(screen.queryByText(/bot user/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('arms the disconnect confirm instead of disconnecting immediately', () => {
      render(<SlackFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect slack/i }));
      expect(screen.getByText(/Disconnect Slack\?/i)).toBeDefined();
      expect(state.disconnectIntegration).not.toHaveBeenCalled();
    });

    it('disconnects Slack for the workspace once the confirm is confirmed', async () => {
      render(<SlackFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect slack/i }));
      fireEvent.click(screen.getByRole('button', { name: /^disconnect slack$/i }));
      await waitFor(() =>
        expect(state.disconnectIntegration).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          provider: 'slack',
        }),
      );
    });
  });
});
