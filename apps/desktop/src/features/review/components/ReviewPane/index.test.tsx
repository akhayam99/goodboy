// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../integrations/github/useGithubConnection', () => ({
  useGithubConnection: () => ({ isResolved: true, isAuthenticated: true, refresh: vi.fn() }),
}));
vi.mock('../../../../store/slices/worktrees/useSessionRepo', () => ({
  useSessionRepo: () => ({
    worktreePath: '~/code/harborline/payments-api-webhook-retry',
    repoRoot: 'harborline/payments-api',
    branch: 'hl/fix-duplicate-credit',
    projectId: 'mock-resolve-project-payments-api',
  }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../app/components/Toast';
import {
  SESSION,
  SESSION_ID,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { ReviewPane } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = async (): Promise<void> => {
  render(
    <ToastProvider>
      <ReviewPane session={SESSION} />
    </ToastProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

describe('ReviewPane', () => {
  it('keeps one link to the pull request and none of its controls', async () => {
    seedResolveScene({ expandedThreadId: null });
    const navigate = vi.fn();
    const original = useAppStore.getState().navigate;
    useAppStore.setState({ navigate });
    await mount();

    for (const name of [/^GitHub$/, /Refresh the pull request/, /^Checks /, /Switch pull/]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    fireEvent.click(screen.getByRole('button', { name: /^Open pull request #318/ }));
    expect(navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({ view: expect.objectContaining({ lens: 'pr' }) }),
    });
    useAppStore.setState({ navigate: original });
  });

  it('shows the notes and offers to open a pull request when there is none', async () => {
    seedResolveScene({ expandedThreadId: null });
    useAppStore.setState({
      sessionGithub: {
        [SESSION_ID]: {
          ...useAppStore.getState().sessionGithub[SESSION_ID],
          pr: null,
          detail: null,
        },
      },
    } as never);
    await mount();

    expect(screen.getByText(/No pull request yet/)).toBeDefined();
    expect(screen.getByText('No open notes')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Open a pull request/ }));
    expect(useAppStore.getState().pullRequestModes?.[SESSION_ID]).toBe('create_pr');
    expect(useAppStore.getState().activeLens[SESSION_ID]).toBe('pr');
  });
});
