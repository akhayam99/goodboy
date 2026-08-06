// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { invokeMock, state } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    disconnectGitlab: vi.fn(async () => undefined),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

const WS_ID = 'ws-1' as WorkspaceId;

const DISCONNECTED_STATUS = {
  available: true,
  mode: 'absent',
  version: null,
  user: null,
  scopes: [],
  scoped: false,
};

const rejectSetTokenWith = (message: string): void => {
  invokeMock.mockImplementation(async (command: string) => {
    if (command === 'gh_set_token') {
      return Promise.reject(message);
    }
    return DISCONNECTED_STATUS;
  });
};

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(DISCONNECTED_STATUS);
});
afterEach(cleanup);

import { GithubFormBody } from './GithubFormBody';

const connectWith = async (token: string): Promise<void> => {
  render(<GithubFormBody workspaceId={WS_ID} />);
  fireEvent.change(await screen.findByLabelText(/GitHub personal access token/i), {
    target: { value: token },
  });
  fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
};

describe('a rejected token, through the real tauri wrapper', () => {
  it('shows the written message with nothing in front of it', async () => {
    const written = 'GitHub rejected this token. Check you pasted the whole value, then try again.';
    rejectSetTokenWith(written);

    await connectWith('ghp_bad');

    const box = await screen.findByText(/GitHub rejected this token/);
    expect(box.textContent).toBe(written);
  });

  it('never names an internal command in front of any written cause', async () => {
    const causes = [
      'Paste a personal access token first.',
      'GitHub rejected this token. Check you pasted the whole value, then try again.',
      'This token has expired or was revoked. Create a new one on GitHub and paste it here.',
      'This token is missing the access Goodboy needs. Recreate it with the repo scope, and authorize it for your org if SSO is on.',
      'Goodboy cannot reach github.com. Check your connection, then try again.',
      'GitHub is rate limiting this token. Wait a few minutes, then try again.',
      'Goodboy cannot verify the certificate github.com presented. Check your system clock and any proxy or VPN in the way, then try again.',
      'Goodboy cannot find the gh CLI. Install it from cli.github.com, then restart Goodboy.',
    ];

    for (const cause of causes) {
      rejectSetTokenWith(cause);
      await connectWith('ghp_bad');
      const box = await screen.findByText(cause);
      expect(box.textContent).toBe(cause);
      cleanup();
    }
  });
});
