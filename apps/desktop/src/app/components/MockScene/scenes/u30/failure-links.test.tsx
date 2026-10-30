// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U30_FAILURE_LINKS_SCENES } from './failure-links';

const WAIT = { timeout: 15_000 };
const SETTLE_MS = 2_000;

const pendingInvoke = () => new Promise<never>(() => undefined);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_execute: pendingInvoke,
    db_select: pendingInvoke,
    worktree_status: pendingInvoke,
    worktree_remote_url: pendingInvoke,
    worktree_changed_files: pendingInvoke,
    project_git_status: pendingInvoke,
    check_provider_budget: pendingInvoke,
    workflow_list: pendingInvoke,
    turn_quiet: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
});

type SceneName = keyof typeof U30_FAILURE_LINKS_SCENES;

const mount = (name: SceneName): void => {
  const Scene = U30_FAILURE_LINKS_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u30 failure link scenes', () => {
  it('registers every scene for the capture', () => {
    for (const [name, Scene] of Object.entries(U30_FAILURE_LINKS_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
  });

  it('u30-failure-reason keeps the whole blocked reason in the tail and offers the transcript', async () => {
    mount('u30-failure-reason');

    const tail = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-auto-tail]');
      expect(found?.textContent).toContain('waiting on the notify-relay queue to drain.');
      return found;
    }, WAIT);
    if (tail === null || tail === undefined) {
      throw new Error('no tail');
    }
    within(tail).getByRole('button', { name: 'View transcript' });
    within(tail).getByRole('button', { name: 'Retry' });
  });

  it('u30-human-call offers View transcript on a run that needs a human call', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    mount('u30-human-call');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const tail = document.querySelector<HTMLElement>('[data-orchestrated-tail]');
    if (tail === null) {
      throw new Error('no tail');
    }
    fireEvent.click(within(tail).getByRole('button', { name: 'View transcript' }));
    const drawer = useAppStore.getState().drawer;
    expect(drawer?.kind).toBe('transcript');
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});
