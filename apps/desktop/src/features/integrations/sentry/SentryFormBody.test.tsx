// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import { chooseListboxValue } from '../../../__tests__/helpers/listbox';

const { state, client, openUrl } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectSentry: vi.fn(async (_params: unknown) => undefined),
    disconnectIntegration: vi.fn(async () => undefined),
    forgetIntegrationCredential: vi.fn(async () => undefined),
    integrationCredentials: [] as ReadonlyArray<unknown>,
    integrationCredentialUsage: {} as Record<string, number>,
    projects: [] as ReadonlyArray<unknown>,
    projectSentryLinks: {} as Record<string, ReadonlyArray<unknown>>,
    loadProjectSentryLinks: vi.fn(async () => undefined),
    linkSentryProject: vi.fn(async () => undefined),
    unlinkSentryProject: vi.fn(async () => undefined),
  },
  client: {
    sentryListCodeMappings: vi.fn(async () => []),
    sentryListOrganizations: vi.fn(async (_params: unknown) => [
      { slug: 'northwind', name: 'Northwind' },
    ]),
    sentryListProjects: vi.fn(async (_params: unknown) => [
      { id: '4501', slug: 'payments-api', name: 'payments-api', platform: 'python' },
      { id: '4502', slug: 'storefront-web', name: 'storefront-web', platform: null },
    ]),
  },
  openUrl: vi.fn(async (_url: string) => undefined),
}));

vi.mock('../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('./client', () => client);

vi.mock('../../../shared/lib/editor', () => ({ openUrl }));

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

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectSentry.mockClear();
  state.disconnectIntegration = vi.fn(async () => undefined);
  state.integrationCredentials = [];
  client.sentryListOrganizations.mockClear();
  client.sentryListProjects.mockClear();
  openUrl.mockClear();
});
afterEach(cleanup);

import { SentryFormBody } from './SentryFormBody';

describe('SentryFormBody', () => {
  it('starts with the Sentry button that opens the token page', () => {
    render(<SentryFormBody workspaceId={WS_ID} />);

    fireEvent.click(screen.getByRole('button', { name: /Open Sentry/ }));

    expect(openUrl).toHaveBeenCalledWith('https://sentry.io/settings/account/api/auth-tokens/');
    expect(screen.getByLabelText('Auth token')).toBeDefined();
  });

  it('checks the token on paste, then picks org and project from lists', async () => {
    const onConnected = vi.fn();
    render(<SentryFormBody workspaceId={WS_ID} onConnected={onConnected} />);

    fireEvent.change(screen.getByLabelText('Auth token'), { target: { value: ' sntryu_x ' } });

    await waitFor(() =>
      expect(screen.getByText('The token works. 1 organization found.')).toBeDefined(),
    );
    chooseListboxValue({
      trigger: screen.getByLabelText('Sentry organization'),
      value: 'northwind',
    });
    await waitFor(() =>
      expect(client.sentryListProjects).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'sntryu_x', org: 'northwind' }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Sentry project').hasAttribute('disabled')).toBe(false),
    );
    chooseListboxValue({ trigger: screen.getByLabelText('Sentry project'), value: 'payments-api' });

    await waitFor(() => expect(onConnected).toHaveBeenCalled());
    expect(state.connectSentry).toHaveBeenCalledWith({
      workspaceId: WS_ID,
      token: 'sntryu_x',
      org: 'northwind',
      project: 'payments-api',
      credentialId: null,
    });
  });

  it('says what went wrong when Sentry refuses the token', async () => {
    client.sentryListOrganizations.mockRejectedValueOnce(new Error('status 401: invalid token'));
    render(<SentryFormBody workspaceId={WS_ID} />);

    fireEvent.change(screen.getByLabelText('Auth token'), { target: { value: 'bad' } });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('401'));
  });

  describe('when Sentry is already connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [sentryIntegration] };
    });

    it('renders one connected row with project name, org and project', () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected to My Project/i)).toBeDefined();
      expect(screen.getByText('my-org/my-proj')).toBeDefined();
      expect(screen.queryByRole('list', { name: 'Connect Sentry' })).toBeNull();
    });

    it('disconnects Sentry for the workspace once the confirm is confirmed', async () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect sentry/i }));
      expect(state.disconnectIntegration).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /^disconnect sentry$/i }));
      await waitFor(() =>
        expect(state.disconnectIntegration).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          provider: 'sentry',
        }),
      );
    });
  });
});
