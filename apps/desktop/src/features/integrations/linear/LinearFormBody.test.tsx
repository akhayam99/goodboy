// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectLinear: vi.fn(async () => undefined),
    disconnectIntegration: vi.fn(async () => undefined),
    forgetIntegrationCredential: vi.fn(async () => undefined),
    integrationCredentials: [] as ReadonlyArray<unknown>,
    integrationCredentialUsage: {} as Record<string, number>,
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../shared/lib/editor', () => ({
  openUrl: vi.fn(async () => undefined),
}));

const WS_ID = 'ws-1' as WorkspaceId;

const linearIntegration = {
  id: 'wi-1',
  workspaceId: WS_ID,
  provider: 'linear' as const,
  credentialId: 'cred-1' as IntegrationCredentialId,
  config: { viewerName: 'Ada Lovelace', workspaceUrlKey: 'acme' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectLinear = vi.fn(async () => undefined);
  state.disconnectIntegration = vi.fn(async () => undefined);
  state.forgetIntegrationCredential = vi.fn(async () => undefined);
  state.integrationCredentials = [];
  state.integrationCredentialUsage = {};
});
afterEach(cleanup);

import { LinearFormBody } from './LinearFormBody';

describe('LinearFormBody', () => {
  it('opens the security page from step one and marks it done', () => {
    render(<LinearFormBody workspaceId={WS_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /open linear/i }));
    expect(screen.getByLabelText('API key')).toBeDefined();
  });

  it('verifies on its own once a key is pasted, with no submit button', async () => {
    render(<LinearFormBody workspaceId={WS_ID} />);
    fireEvent.change(screen.getByLabelText('API key'), {
      target: { value: '  lin_api_x  ' },
    });
    expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();

    await waitFor(
      () =>
        expect(state.connectLinear).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          token: 'lin_api_x',
          credentialId: null,
        }),
      { timeout: 2000 },
    );
  });

  it('fires onConnected once the key checks out', async () => {
    const onConnected = vi.fn();
    render(<LinearFormBody workspaceId={WS_ID} onConnected={onConnected} />);
    fireEvent.change(screen.getByLabelText('API key'), {
      target: { value: 'lin_api_x' },
    });
    await waitFor(() => expect(onConnected).toHaveBeenCalledOnce(), { timeout: 2000 });
  });

  it('shows the formatted error inline and skips onConnected when the key fails', async () => {
    const onConnected = vi.fn();
    state.connectLinear = vi.fn(async () => {
      throw new Error('unauthorized');
    });
    render(<LinearFormBody workspaceId={WS_ID} onConnected={onConnected} />);
    fireEvent.change(screen.getByLabelText('API key'), {
      target: { value: 'lin_api_bad' },
    });
    expect(await screen.findByText(/unauthorized/i, {}, { timeout: 2000 })).toBeDefined();
    expect(onConnected).not.toHaveBeenCalled();
  });

  it('names the exact Linear buttons to press', () => {
    render(<LinearFormBody workspaceId={WS_ID} />);
    expect(screen.getByText(/security & access/i)).toBeDefined();
    expect(screen.getByText(/new api key/i)).toBeDefined();
  });

  it('says what happens when a member cannot create keys', () => {
    render(<LinearFormBody workspaceId={WS_ID} />);
    expect(screen.getByText(/a Linear admin has turned them off for members/i)).toBeDefined();
  });

  it('always shows what Goodboy can do with the key', () => {
    render(<LinearFormBody workspaceId={WS_ID} />);
    expect(screen.getByText('What Goodboy can do with this')).toBeDefined();
    expect(screen.getByText(/stored in your mac's keychain/i)).toBeDefined();
  });

  describe('when Linear is already connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [linearIntegration] };
    });

    it('renders one connected row with viewer and workspace', () => {
      render(<LinearFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected as Ada Lovelace/i)).toBeDefined();
      expect(screen.getByText('linear.app/acme')).toBeDefined();
      expect(screen.queryByLabelText('API key')).toBeNull();
    });

    it('arms the disconnect confirm instead of disconnecting immediately', () => {
      render(<LinearFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect linear/i }));
      expect(screen.getByText(/Disconnect Linear\?/i)).toBeDefined();
      expect(state.disconnectIntegration).not.toHaveBeenCalled();
    });

    it('disconnects Linear for the workspace once the confirm is confirmed', async () => {
      render(<LinearFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /disconnect linear/i }));
      fireEvent.click(screen.getByRole('button', { name: /^disconnect linear$/i }));
      await waitFor(() =>
        expect(state.disconnectIntegration).toHaveBeenCalledWith({
          workspaceId: WS_ID,
          provider: 'linear',
        }),
      );
    });
  });
});
