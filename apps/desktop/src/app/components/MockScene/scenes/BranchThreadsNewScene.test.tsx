// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

describe('the unread threads scenes', () => {
  it('reads six open threads, one that needs you and two unread on the pull request page', async () => {
    renderScene('pr');

    const line = await screen.findByTestId('open-threads');

    expect(line.textContent).toBe('6 open threads · 1 needs you · 2 unread');
  });

  it('marks the two unread threads in the Comments tab and keeps the marks for the visit', async () => {
    renderScene('comments');

    expect(await screen.findAllByRole('img', { name: 'Unread' })).toHaveLength(2);
    await waitFor(() => {
      const reads = useAppStore.getState().sessionThreadReads[SESSION_ID] ?? {};
      expect(Object.keys(reads).length).toBeGreaterThan(2);
    });
    expect(screen.getAllByRole('img', { name: 'Unread' })).toHaveLength(2);
  });

  it('keeps the two marks after the Resolved view is shown and left', async () => {
    renderScene('comments');
    expect(await screen.findAllByRole('img', { name: 'Unread' })).toHaveLength(2);

    fireEvent.click(screen.getByRole('tab', { name: /Resolved/ }));
    await waitFor(() => expect(screen.queryAllByRole('img', { name: 'Unread' })).toHaveLength(0));
    fireEvent.click(screen.getByRole('tab', { name: /Open/ }));

    expect(await screen.findAllByRole('img', { name: 'Unread' })).toHaveLength(2);
  });

  it('puts the mark in the gutter of a thread that needs you, next to its state word', async () => {
    renderScene('comments');

    const marks = await screen.findAllByRole('img', { name: 'Unread' });
    const rows = marks
      .map((mark) => mark.closest('[class*="group/review-row"]'))
      .filter((element): element is HTMLElement => element instanceof HTMLElement);

    expect(rows.some((row) => within(row).queryByText('Question for you') !== null)).toBe(true);
    for (const mark of marks) {
      expect(mark.closest('button')).toBeNull();
    }
  });

  it('frames the Comments list for the changelog picture and leaves the page whole', async () => {
    const comments = renderScene('comments');
    await screen.findAllByRole('img', { name: 'Unread' });
    const frame = comments.container.querySelector<HTMLElement>('[data-shot]');

    const inFrame = within(frame ?? document.body);

    expect(frame?.style.width).toBe('680px');
    expect(frame?.style.height).toBe('440px');
    expect(inFrame.getAllByRole('img', { name: 'Unread' })).toHaveLength(2);
    expect(inFrame.queryByRole('tab', { name: /Resolved/ })).not.toBeNull();
    cleanup();

    const page = renderScene('pr');
    await screen.findByTestId('open-threads');

    expect(page.container.querySelector('[data-shot]')).toBeNull();
  });

  it('shows no mark on the next visit because the threads were read', async () => {
    renderScene('comments');
    expect(await screen.findAllByRole('img', { name: 'Unread' })).toHaveLength(2);

    await showTab('files');
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Comments' })).toBeNull());
    await showTab('comments');

    await screen.findByRole('navigation', { name: 'Comments' });
    expect(screen.queryAllByRole('img', { name: 'Unread' })).toHaveLength(0);
  });
});
