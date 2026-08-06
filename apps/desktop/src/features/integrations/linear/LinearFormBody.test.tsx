// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectLinear: vi.fn(async () => undefined),
    disconnectLinear: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

const WS_ID = 'ws-1' as WorkspaceId;

const linearIntegration = {
  id: 'wi-1',
  workspaceId: WS_ID,
  provider: 'linear' as const,
  credentialKey: 'cred-1',
  config: { viewerName: 'Ada Lovelace', workspaceUrlKey: 'acme' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectLinear = vi.fn(async () => undefined);
  state.disconnectLinear = vi.fn(async () => undefined);
});
afterEach(cleanup);

import { LinearFormBody } from './LinearFormBody';

describe('LinearFormBody', () => {
  describe('connect form (happy path)', () => {
    it('disables Connect until a non-empty token is entered', () => {
      render(<LinearFormBody workspaceId={WS_ID} />);
      const btn = screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/personal access token/i), {
        target: { value: 'lin_api_x' },
      });
      expect(btn.disabled).toBe(false);
    });

    it('connects with the trimmed token and fires onConnected', async () => {
      const onConnected = vi.fn();
      render(<LinearFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      fireEvent.change(screen.getByLabelText(/personal access token/i), {
        target: { value: '  lin_api_x  ' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      await waitFor(() => expect(state.connectLinear).toHaveBeenCalledWith(WS_ID, 'lin_api_x'));
      await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
    });

    it('shows the formatted error and skips onConnected when the connect fails', async () => {
      const onConnected = vi.fn();
      state.connectLinear = vi.fn(async () => {
        throw new Error('unauthorized');
      });
      render(<LinearFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      fireEvent.change(screen.getByLabelText(/personal access token/i), {
        target: { value: 'lin_api_bad' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      expect(await screen.findByText(/unauthorized/i)).toBeDefined();
      expect(onConnected).not.toHaveBeenCalled();
    });
  });

  describe('when Linear is already connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [linearIntegration] };
    });

    it('renders the connected state with viewer and workspace', () => {
      render(<LinearFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected as Ada Lovelace/i)).toBeDefined();
      expect(screen.getByText('linear.app/acme')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('disconnects Linear for the workspace', () => {
      render(<LinearFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));
      expect(state.disconnectLinear).toHaveBeenCalledWith(WS_ID);
    });
  });

  it('says where the token travels instead of claiming it never leaves', () => {
    render(<LinearFormBody workspaceId={WS_ID} />);
    expect(screen.getByText(/never touches Goodboy's own servers/i)).toBeDefined();
    expect(screen.queryByText(/never leaves this machine/i)).toBeNull();
    expect(screen.queryByText(/never leaving this machine/i)).toBeNull();
  });
});
