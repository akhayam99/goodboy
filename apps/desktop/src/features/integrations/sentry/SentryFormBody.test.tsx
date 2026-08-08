// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    connectSentry: vi.fn(async () => undefined),
    disconnectSentry: vi.fn(async () => undefined),
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
  credentialKey: 'cred-1',
  config: { org: 'my-org', project: 'my-proj', projectName: 'My Project' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const fillForm = ({ token, org, project }: { token: string; org: string; project: string }) => {
  fireEvent.change(screen.getByLabelText(/auth token/i), { target: { value: token } });
  fireEvent.change(screen.getByLabelText(/organization slug/i), { target: { value: org } });
  fireEvent.change(screen.getByLabelText(/project slug/i), { target: { value: project } });
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.connectSentry = vi.fn(async () => undefined);
  state.disconnectSentry = vi.fn(async () => undefined);
});
afterEach(cleanup);

import { SentryFormBody } from './SentryFormBody';

describe('SentryFormBody', () => {
  describe('connect form (happy path)', () => {
    it('keeps Connect disabled until token, org and project are all filled', () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      const btn = screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/auth token/i), { target: { value: 'sntryu_x' } });
      expect(btn.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/organization slug/i), { target: { value: 'org' } });
      expect(btn.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(/project slug/i), { target: { value: 'proj' } });
      expect(btn.disabled).toBe(false);
    });

    it('connects with all trimmed fields and fires onConnected', async () => {
      const onConnected = vi.fn();
      render(<SentryFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      fillForm({ token: '  sntryu_x  ', org: '  my-org  ', project: '  my-proj  ' });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      await waitFor(() =>
        expect(state.connectSentry).toHaveBeenCalledWith(WS_ID, 'sntryu_x', 'my-org', 'my-proj'),
      );
      await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
    });

    it('shows the formatted error and skips onConnected when the connect fails', async () => {
      const onConnected = vi.fn();
      state.connectSentry = vi.fn(async () => {
        throw new Error('project not found');
      });
      render(<SentryFormBody workspaceId={WS_ID} onConnected={onConnected} />);
      fillForm({ token: 'sntryu_x', org: 'org', project: 'proj' });
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      expect(await screen.findByText(/project not found/i)).toBeDefined();
      expect(onConnected).not.toHaveBeenCalled();
    });
  });

  describe('when Sentry is already connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [sentryIntegration] };
    });

    it('renders the connected state with project name, org and project', () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      expect(screen.getByText(/Connected to My Project/i)).toBeDefined();
      expect(screen.getByText('my-org')).toBeDefined();
      expect(screen.getByText('my-proj')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull();
    });

    it('arms the disconnect confirm instead of disconnecting immediately', () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));
      expect(screen.getByText(/Disconnect Sentry\?/i)).toBeDefined();
      expect(state.disconnectSentry).not.toHaveBeenCalled();
    });

    it('disconnects Sentry for the workspace once the confirm is confirmed', () => {
      render(<SentryFormBody workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^disconnect sentry$/i }));
      expect(state.disconnectSentry).toHaveBeenCalledWith(WS_ID);
    });
  });

  it('says where the token travels instead of claiming it never leaves', () => {
    render(<SentryFormBody workspaceId={WS_ID} />);
    expect(screen.getByText(/never touches Goodboy's own servers/i)).toBeDefined();
    expect(screen.queryByText(/never leaves this machine/i)).toBeNull();
    expect(screen.queryByText(/never leaving this machine/i)).toBeNull();
  });
});
