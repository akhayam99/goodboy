// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IntegrationCredentialId, JiraIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { chooseListboxValue } from '../../../__tests__/helpers/listbox';

const { state, client, openUrl } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectJira: vi.fn(async (_params: unknown) => undefined),
    disconnectIntegration: vi.fn(async () => undefined),
    forgetIntegrationCredential: vi.fn(async () => undefined),
    integrationCredentials: [] as ReadonlyArray<unknown>,
    integrationCredentialUsage: {} as Record<string, number>,
  },
  client: {
    jiraValidateConnection: vi.fn(async (_params: unknown) => ({
      accountId: 'acc-1',
      displayName: 'Priya Moss',
    })),
    jiraListProjects: vi.fn(async (_params: unknown) => [
      { id: '10000', key: 'ENG', name: 'Engineering' },
      { id: '10001', key: 'OPS', name: 'Operations' },
    ]),
  },
  openUrl: vi.fn(async (_url: string) => undefined),
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('./client', () => client);

vi.mock('../../../shared/lib/editor', () => ({ openUrl }));

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

const fillStepTwo = () => {
  fireEvent.change(screen.getByLabelText('Site'), { target: { value: 'acme.atlassian.net/' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' grace@acme.com ' } });
  fireEvent.change(screen.getByLabelText('API token'), { target: { value: ' ATATT-x ' } });
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectJira.mockClear();
  state.disconnectIntegration = vi.fn(async () => undefined);
  state.integrationCredentials = [];
  client.jiraValidateConnection.mockClear();
  client.jiraListProjects.mockClear();
  openUrl.mockClear();
});
afterEach(cleanup);

import { JiraFormBody } from './JiraFormBody';

describe('JiraFormBody', () => {
  it('starts with the Atlassian button and shows all three fields at once', () => {
    render(<JiraFormBody workspaceId={WS_ID} />);

    fireEvent.click(screen.getByRole('button', { name: /Open Atlassian/ }));

    expect(openUrl).toHaveBeenCalledWith(
      'https://id.atlassian.com/manage-profile/security/api-tokens',
    );
    expect(screen.getByLabelText('Site')).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('API token')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
  });

  it('checks the key on its own and lists the projects to pick from', async () => {
    const onConnected = vi.fn();
    render(<JiraFormBody workspaceId={WS_ID} onConnected={onConnected} />);

    fillStepTwo();

    await waitFor(() => expect(screen.getByText('Signed in as Priya Moss')).toBeDefined());
    expect(client.jiraValidateConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        siteUrl: 'https://acme.atlassian.net',
        email: 'grace@acme.com',
        apiToken: 'ATATT-x',
      }),
    );
    chooseListboxValue({ trigger: screen.getByLabelText('Jira project'), value: 'OPS' });

    await waitFor(() => expect(onConnected).toHaveBeenCalled());
    expect(state.connectJira).toHaveBeenCalledWith({
      workspaceId: WS_ID,
      siteUrl: 'https://acme.atlassian.net',
      email: 'grace@acme.com',
      projectKey: 'OPS',
      apiToken: 'ATATT-x',
      credentialId: null,
    });
  });

  it('says what went wrong inside the step when the key is refused', async () => {
    client.jiraValidateConnection.mockRejectedValueOnce(new Error('Jira said 401: bad token'));
    render(<JiraFormBody workspaceId={WS_ID} />);

    fillStepTwo();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('401'));
    expect(client.jiraListProjects).not.toHaveBeenCalled();
  });

  it('says what Goodboy can do and that only Jira Cloud works', () => {
    render(<JiraFormBody workspaceId={WS_ID} />);
    expect(screen.getByText('Comments as you')).toBeDefined();
    expect(screen.getByText(/Data Center and Server are not supported/)).toBeDefined();
  });

  describe('when connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [jiraIntegration] };
    });

    it('renders one connected row with site and project instead of the steps', () => {
      render(<JiraFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected as Grace Hopper/i)).toBeDefined();
      expect(screen.getByText('https://acme.atlassian.net (ENG)')).toBeDefined();
      expect(screen.queryByRole('list', { name: 'Connect Jira' })).toBeNull();
    });

    it('disconnects Jira for the workspace once the confirm is confirmed', async () => {
      render(<JiraFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect jira/i }));
      expect(state.disconnectIntegration).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /^disconnect jira$/i }));
      await waitFor(() =>
        expect(state.disconnectIntegration).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          provider: 'jira',
        }),
      );
    });
  });
});
