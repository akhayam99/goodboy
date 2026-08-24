// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  BitbucketIntegrationBinding,
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

const bitbucketIntegration: BitbucketIntegrationBinding = {
  id: 'wi-1' as never,
  workspaceId: WS_ID,
  projectId: null,
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
  fireEvent.change(screen.getByLabelText(/personal API key/i), { target: { value: ' ATATT-x ' } });
  fireEvent.change(screen.getByLabelText(/workspace slug/i), {
    target: { value: 'https://bitbucket.org/GoodBoy/desktop' },
  });
  fireEvent.change(screen.getByLabelText(/account email/i), {
    target: { value: ' grace@acme.com ' },
  });
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
  it('shows the token field first and the get-a-token link right under it', () => {
    render(<BitbucketFormBody workspaceId={WS_ID} />);

    const field = screen.getByLabelText(/personal API key/i);
    const link = screen.getByRole('link', { name: /get an API token from Atlassian/i });

    expect(field.compareDocumentPosition(link)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps slug and email out of sight until the token is pasted', () => {
    render(<BitbucketFormBody workspaceId={WS_ID} />);
    expect(screen.queryByLabelText(/workspace slug/i)).toBeNull();
    expect(screen.queryByLabelText(/account email/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/personal API key/i), {
      target: { value: 'ATATT-x' },
    });
    expect(screen.getByLabelText(/workspace slug/i)).toBeDefined();
    expect(screen.getByLabelText(/account email/i)).toBeDefined();
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

    it('renders one connected row with the workspace instead of the form', () => {
      render(<BitbucketFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected as Grace Hopper/i)).toBeDefined();
      expect(screen.getByText('bitbucket.org/goodboy')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('arms the disconnect confirm instead of disconnecting immediately', () => {
      render(<BitbucketFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect bitbucket/i }));
      expect(screen.getByText(/Disconnect Bitbucket\?/i)).toBeDefined();
      expect(state.disconnectIntegration).not.toHaveBeenCalled();
    });

    it('disconnects Bitbucket for the workspace once the confirm is confirmed', async () => {
      render(<BitbucketFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect bitbucket/i }));
      fireEvent.click(screen.getByRole('button', { name: /^disconnect bitbucket$/i }));
      await waitFor(() =>
        expect(state.disconnectIntegration).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          provider: 'bitbucket',
        }),
      );
    });
  });

  it('keeps the cloud-only note behind a quiet disclosure and says where the token travels', () => {
    render(<BitbucketFormBody workspaceId={WS_ID} />);
    expect(screen.queryByText(/never touches Goodboy's own servers/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /bitbucket cloud only/i }));
    expect(screen.getByText(/never touches Goodboy's own servers/i)).toBeDefined();
    expect(screen.getByText(/app password works in the same field/i)).toBeDefined();
    expect(screen.queryByText(/never leaves this machine/i)).toBeNull();
  });
});
