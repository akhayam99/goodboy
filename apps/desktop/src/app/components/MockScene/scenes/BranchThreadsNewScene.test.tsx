// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SESSION_ID } from './resolveSeed';
import { BranchThreadsNewScene } from './BranchThreadsNewScene';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [] });
});

afterEach(cleanup);

const renderScene = (tab: 'pr' | 'comments') =>
  render(
    <ToastProvider>
      <BranchThreadsNewScene tab={tab} />
    </ToastProvider>,
  );

const showTab = async (tab: 'files' | 'comments'): Promise<void> => {
  await act(async () => {
    useAppStore.setState({ branchTab: { [SESSION_ID]: tab } });
  });
};

describe('the new threads scenes', () => {
  it('reads six open threads, two new and one that needs you on the pull request page', async () => {
    renderScene('pr');

    const line = await screen.findByTestId('open-threads');

    expect(line.textContent).toBe('6 open threads · 2 new · 1 needs you');
  });

  it('marks the two new threads in the Comments tab and keeps the marks for the visit', async () => {
    renderScene('comments');

    expect(await screen.findAllByRole('img', { name: 'New' })).toHaveLength(2);
    await waitFor(() => {
      const reads = useAppStore.getState().sessionThreadReads[SESSION_ID] ?? {};
      expect(Object.keys(reads).length).toBeGreaterThan(2);
    });
    expect(screen.getAllByRole('img', { name: 'New' })).toHaveLength(2);
  });

  it('shows no mark on the next visit because the threads were read', async () => {
    renderScene('comments');
    expect(await screen.findAllByRole('img', { name: 'New' })).toHaveLength(2);

    await showTab('files');
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Comments' })).toBeNull());
    await showTab('comments');

    await screen.findByRole('navigation', { name: 'Comments' });
    expect(screen.queryAllByRole('img', { name: 'New' })).toHaveLength(0);
  });
});
