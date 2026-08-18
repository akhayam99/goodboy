// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  BitbucketWorkspaceIntegration,
  IntegrationCredentialId,
  WorkspaceId,
} from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectBitbucket: vi.fn(async () => undefined),
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

const bitbucketIntegration: BitbucketWorkspaceIntegration = {
  id: 'wi-1' as never,
  workspaceId: WS_ID,
  provider: 'bitbucket',
  credentialId: 'cred-1' as IntegrationCredentialId,
  config: {
    workspaceSlug: 'goodboy',
    email: 'grace@acme.com',
    displayName: 'Grace Hopper',
  },
  createdAt: '2026-01-01T00:00:00.000Z' as never,
  updatedAt: '2026-01-01T00:00:00.000Z' as never,
};

const fillConnectForm = () => {
  fireEvent.change(screen.getByLabelText(/workspace slug/i), {
    target: { value: 'https://bitbucket.org/GoodBoy/desktop' },
  });
  fireEvent.change(screen.getByLabelText(/account email/i), {
    target: { value: ' grace@acme.com ' },
  });
  fireEvent.change(screen.getByLabelText(/personal API key/i), { target: { value: ' ATATT-x ' } });
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectBitbucket = vi.fn(async () => undefined);
  state.disconnectIntegration = vi.fn(async () => undefined);
  state.forgetIntegrationCredential = vi.fn(async () => undefined);
  state.integrationCredentials = [];
  state.integrationCredentialUsage = {};
});
afterEach(cleanup);

import { BitbucketFormBody } from './BitbucketFormBody';

describe('BitbucketFormBody', () => {
  it('offers the token link before the token field', () => {
    render(<BitbucketFormBody workspaceId={WS_ID} />);

    const link = screen.getByRole('link', { name: /create an API token/i });
    const field = screen.getByLabelText(/personal API key/i);

    expect(link.compareDocumentPosition(field)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps Connect disabled until every field is filled', () => {
    render(<BitbucketFormBody workspaceId={WS_ID} />);
    const connect = screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement;
    expect(connect.disabled).toBe(true);
    fillConnectForm();
    expect(connect.disabled).toBe(false);
  });

  it('reduces a pasted repository url to the workspace slug and trims the rest', async () => {
    const onConnected = vi.fn();
    render(<BitbucketFormBody workspaceId={WS_ID} onConnected={onConnected} />);
    fillConnectForm();
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    await waitFor(() =>
      expect(state.connectBitbucket).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        workspaceSlug: 'goodboy',
        email: 'grace@acme.com',
        apiToken: 'ATATT-x',
        credentialId: null,
      }),
    );
    await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
  });

  it('shows the failure and skips onConnected when the connect is rejected', async () => {
    const onConnected = vi.fn();
    state.connectBitbucket = vi.fn(async () => {
      throw new Error('Bitbucket rejected the credentials');
    });
    render(<BitbucketFormBody workspaceId={WS_ID} onConnected={onConnected} />);
    fillConnectForm();
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    expect(await screen.findByText(/Bitbucket rejected the credentials/i)).toBeDefined();
    expect(onConnected).not.toHaveBeenCalled();
  });

  describe('when Bitbucket is already connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [bitbucketIntegration] };
    });

    it('shows the workspace and account instead of the form', () => {
      render(<BitbucketFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected as Grace Hopper/i)).toBeDefined();
      expect(screen.getByText('goodboy')).toBeDefined();
      expect(screen.getByText('grace@acme.com')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('arms the disconnect confirm instead of disconnecting immediately', () => {
      render(<BitbucketFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));
      expect(screen.getByText(/Disconnect Bitbucket\?/i)).toBeDefined();
      expect(state.disconnectIntegration).not.toHaveBeenCalled();
    });

    it('disconnects Bitbucket for the workspace once the confirm is confirmed', () => {
      render(<BitbucketFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^disconnect bitbucket$/i }));
      expect(state.disconnectIntegration).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        provider: 'bitbucket',
      });
    });
  });

  it('says where the token travels instead of claiming it never leaves', () => {
    render(<BitbucketFormBody workspaceId={WS_ID} />);
    expect(screen.getByText(/never touches Goodboy's own servers/i)).toBeDefined();
    expect(screen.queryByText(/never leaves this machine/i)).toBeNull();
    expect(screen.queryByText(/never leaving this machine/i)).toBeNull();
  });
});
