// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  IntegrationCredentialId,
  JiraWorkspaceIntegration,
  ProjectId,
  WorkspaceId,
} from '@goodboy/types';

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
const PROJECT_ID = 'project-1' as ProjectId;

const jiraIntegration: JiraWorkspaceIntegration = {
  id: 'wi-1' as never,
  workspaceId: PROJECT_ID,
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
  fireEvent.change(screen.getByLabelText(/site url/i), {
    target: { value: 'acme.atlassian.net/' },
  });
  fireEvent.change(screen.getByLabelText(/account email/i), {
    target: { value: ' grace@acme.com ' },
  });
  fireEvent.change(screen.getByLabelText(/project key/i), { target: { value: 'eng' } });
  fireEvent.change(screen.getByLabelText(/personal API key/i), { target: { value: ' ATATT-x ' } });
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

describe('JiraFormBody credential link', () => {
  it('offers the token link before the token field', () => {
    render(<JiraFormBody workspaceId={WS_ID} />);

    const link = screen.getByRole('link', { name: /create an API token/i });
    const field = screen.getByLabelText(/personal API key/i);

    expect(link.compareDocumentPosition(field)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe('JiraFormBody', () => {
  it('keeps Connect disabled until every field is filled', () => {
    render(<JiraFormBody workspaceId={WS_ID} />);
    const connect = screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement;
    expect(connect.disabled).toBe(true);
    fillConnectForm();
    expect(connect.disabled).toBe(false);
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
      throw new Error('Jira rejected the credentials');
    });
    render(<JiraFormBody workspaceId={WS_ID} onConnected={onConnected} />);
    fillConnectForm();
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    expect(await screen.findByText(/Jira rejected the credentials/i)).toBeDefined();
    expect(onConnected).not.toHaveBeenCalled();
  });

  describe('when Jira is already connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [jiraIntegration] };
    });

    it('shows the site and project instead of the form', () => {
      render(<JiraFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected as Grace Hopper/i)).toBeDefined();
      expect(screen.getByText('https://acme.atlassian.net')).toBeDefined();
      expect(screen.getByText('ENG')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('arms the disconnect confirm instead of disconnecting immediately', () => {
      render(<JiraFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));
      expect(screen.getByText(/Disconnect Jira\?/i)).toBeDefined();
      expect(state.disconnectIntegration).not.toHaveBeenCalled();
    });

    it('disconnects Jira for the workspace once the confirm is confirmed', () => {
      render(<JiraFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^disconnect jira$/i }));
      expect(state.disconnectIntegration).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        provider: 'jira',
      });
    });
  });

  it('says where the token travels instead of claiming it never leaves', () => {
    render(<JiraFormBody workspaceId={WS_ID} />);
    expect(screen.getByText(/never touches Goodboy's own servers/i)).toBeDefined();
    expect(screen.queryByText(/never leaves this machine/i)).toBeNull();
    expect(screen.queryByText(/never leaving this machine/i)).toBeNull();
  });
});
