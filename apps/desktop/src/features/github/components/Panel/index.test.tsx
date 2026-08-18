// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

type MockState = {
  githubStatus:
    | null
    | { available: false }
    | { available: true; mode: 'absent' }
    | {
        available: true;
        mode: 'connected';
        user: string;
        version?: string;
        scopes?: ReadonlyArray<string>;
      };
  refreshGithubStatus: ReturnType<typeof vi.fn>;
  setGithubPat: ReturnType<typeof vi.fn>;
  clearGithubToken: ReturnType<typeof vi.fn>;
};

const { state } = vi.hoisted<{ state: MockState }>(() => ({
  state: {
    githubStatus: null,
    refreshGithubStatus: vi.fn(async () => undefined),
    setGithubPat: vi.fn(async () => undefined),
    clearGithubToken: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: MockState) => T) => selector(state),
}));

import { GithubPanel } from './index';

beforeEach(() => {
  state.githubStatus = null;
  state.refreshGithubStatus = vi.fn(async () => undefined);
  state.setGithubPat = vi.fn(async () => undefined);
  state.clearGithubToken = vi.fn(async () => undefined);
});
afterEach(cleanup);

describe('GithubPanel', () => {
  it('shows the gh status check placeholder when status is unknown', () => {
    render(<GithubPanel />);
    expect(screen.getByText(/checking gh status/i)).toBeDefined();
    expect(state.refreshGithubStatus).toHaveBeenCalled();
  });

  it('shows the install-gh hint when gh is not available', () => {
    state.githubStatus = { available: false };
    render(<GithubPanel />);
    expect(screen.getByText(/gh cli not detected/i)).toBeDefined();
  });

  it('submits the token via setGithubPat when Connect is clicked', async () => {
    state.githubStatus = { available: true, mode: 'absent' };
    render(<GithubPanel />);
    fireEvent.change(screen.getByLabelText(/github personal API key/i), {
      target: { value: 'ghp_token' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    });
    expect(state.setGithubPat).toHaveBeenCalledWith('ghp_token');
  });

  it('describes where the token goes without claiming it stays on the machine', () => {
    state.githubStatus = { available: true, mode: 'absent' };
    render(<GithubPanel />);

    expect(document.body.textContent).toContain('never touches Goodboy');
    expect(document.body.textContent).not.toContain('never leaves your machine');
  });

  it('shows connected user info when status is connected', () => {
    state.githubStatus = { available: true, mode: 'connected', user: 'amin' };
    render(<GithubPanel />);
    expect(screen.getByText(/connected as amin/i)).toBeDefined();
  });
});
