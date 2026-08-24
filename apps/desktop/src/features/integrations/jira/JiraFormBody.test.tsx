// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IntegrationCredentialId, JiraIntegrationBinding, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectJira: vi.fn(async () => undefined),
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

const jiraIntegration: JiraIntegrationBinding = {
  id: 'wi-1' as never,
  workspaceId: WS_ID,
  projectId: null,
  provider: 'jira',
  credentialId: 'cred-1' as IntegrationCredentialId,
  config: {
    siteUrl: 'https://acme.atlassian.net',
    email: 'grace@acme.com',
    projectKey: 'ENG',
    displayName: 'Grace Hopper',
  },
  createdAt: '2026-01-01T00:00:00.000Z' as never,
  updatedAt: '2026-01-01T00:00:00.000Z' as never,
};

const fillConnectForm = () => {
  fireEvent.change(screen.getByLabelText(/personal API key/i), { target: { value: ' ATATT-x ' } });
  fireEvent.change(screen.getByLabelText(/site url/i), {
    target: { value: 'acme.atlassian.net/' },
  });
  fireEvent.change(screen.getByLabelText(/account email/i), {
    target: { value: ' grace@acme.com ' },
  });
  fireEvent.change(screen.getByLabelText(/project key/i), { target: { value: 'eng' } });
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectJira = vi.fn(async () => undefined);
  state.disconnectIntegration = vi.fn(async () => undefined);
  state.forgetIntegrationCredential = vi.fn(async () => undefined);
  state.integrationCredentials = [];
  state.integrationCredentialUsage = {};
});
afterEach(cleanup);

import { JiraFormBody } from './JiraFormBody';

describe('JiraFormBody', () => {
  it('shows the token field first and the get-a-token link right under it', () => {
    render(<JiraFormBody workspaceId={WS_ID} />);

    const field = screen.getByLabelText(/personal API key/i);
    const link = screen.getByRole('link', { name: /get an API token from Atlassian/i });

    expect(field.compareDocumentPosition(link)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps site, email and project key out of sight until the token is pasted', () => {
    render(<JiraFormBody workspaceId={WS_ID} />);
    expect(screen.queryByLabelText(/site url/i)).toBeNull();
    expect(screen.queryByLabelText(/account email/i)).toBeNull();
    expect(screen.queryByLabelText(/project key/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/personal API key/i), {
      target: { value: 'ATATT-x' },
    });
    expect(screen.getByLabelText(/site url/i)).toBeDefined();
    expect(screen.getByLabelText(/account email/i)).toBeDefined();
    expect(screen.getByLabelText(/project key/i)).toBeDefined();
  });

  it('keeps Connect disabled until every field is filled', () => {
    render(<JiraFormBody workspaceId={WS_ID} />);
    const btn = screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/personal API key/i), {
      target: { value: 'ATATT-x' },
    });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/site url/i), {
      target: { value: 'acme.atlassian.net' },
    });
    fireEvent.change(screen.getByLabelText(/account email/i), {
      target: { value: 'grace@acme.com' },
    });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/project key/i), { target: { value: 'ENG' } });
    expect(btn.disabled).toBe(false);
  });

  it('normalizes the site url, trims the email and uppercases the project key', async () => {
    const onConnected = vi.fn();
    render(<JiraFormBody workspaceId={WS_ID} onConnected={onConnected} />);
    fillConnectForm();
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    await waitFor(() =>
      expect(state.connectJira).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        siteUrl: 'https://acme.atlassian.net',
        email: 'grace@acme.com',
        projectKey: 'ENG',
        apiToken: 'ATATT-x',
        credentialId: null,
      }),
    );
    await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
  });

  it('shows the failure and skips onConnected when the connect is rejected', async () => {
    const onConnected = vi.fn();
    state.connectJira = vi.fn(async () => {
      throw new Error('site not reachable');
    });
    render(<JiraFormBody workspaceId={WS_ID} onConnected={onConnected} />);
    fillConnectForm();
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    expect(await screen.findByText(/site not reachable/i)).toBeDefined();
    expect(onConnected).not.toHaveBeenCalled();
  });

  describe('when Jira is already connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [jiraIntegration] };
    });

    it('renders one connected row with site and project instead of the form', () => {
      render(<JiraFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected as Grace Hopper/i)).toBeDefined();
      expect(screen.getByText('https://acme.atlassian.net (ENG)')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('arms the disconnect confirm instead of disconnecting immediately', () => {
      render(<JiraFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect jira/i }));
      expect(screen.getByText(/Disconnect Jira\?/i)).toBeDefined();
      expect(state.disconnectIntegration).not.toHaveBeenCalled();
    });

    it('disconnects Jira for the workspace once the confirm is confirmed', async () => {
      render(<JiraFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect jira/i }));
      fireEvent.click(screen.getByRole('button', { name: /^disconnect jira$/i }));
      await waitFor(() =>
        expect(state.disconnectIntegration).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          provider: 'jira',
        }),
      );
    });
  });

  it('keeps the cloud-only note behind a quiet disclosure and says where the token travels', () => {
    render(<JiraFormBody workspaceId={WS_ID} />);
    expect(screen.queryByText(/never touches Goodboy's own servers/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /jira cloud only/i }));
    expect(screen.getByText(/never touches Goodboy's own servers/i)).toBeDefined();
    expect(screen.getByText(/Data Center and Server are not supported/i)).toBeDefined();
    expect(screen.queryByText(/never leaves this machine/i)).toBeNull();
  });
});
