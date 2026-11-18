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
import { SESSION_ID } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { U25_B_RESOLVE_FIX_SCENES } from '../../../../app/components/MockScene/scenes/u25/b-resolve-fix';

type StoreState = ReturnType<StoryStore['getState']>;

type SceneName = keyof typeof U25_B_RESOLVE_FIX_SCENES;

type MountParams = {
  readonly name: SceneName;
};

type RowParams = {
  readonly index: number;
};

type ThreadParams = {
  readonly threadId: string;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    db_transaction: { status: 'committed', results: [] },
    worktree_is_ancestor: false,
    worktree_commits: [],
    worktree_diff_range: '',
  });
});

afterEach(cleanup);

const stub = (actions: Partial<StoreState>): void => {
  useAppStore.setState(actions);
};

const mount = async ({ name }: MountParams): Promise<HTMLElement> => {
  const Scene = U25_B_RESOLVE_FIX_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.findByRole('navigation', { name: 'Comments' }, { timeout: 5000 });
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const rowAt = ({ index }: RowParams): HTMLElement => {
  const items = list().querySelectorAll<HTMLElement>('li');
  const item = Array.from(items).filter(
    (candidate) => candidate.querySelector('[data-row-work]') !== null,
  )[index];
  if (item === undefined) {
    throw new Error(`no row ${index}`);
  }
  return item;
};

const threadOf = ({ index }: RowParams): string =>
  rowAt({ index }).querySelector('[data-thread-id]')?.getAttribute('data-thread-id') ?? '';

const markApplied = ({ threadId }: ThreadParams): void => {
  const queue = useAppStore.getState().sessionResolveQueueItems[SESSION_ID] ?? [];
  const target = queue.find((entry) => entry.thread.threadId === threadId);
  useAppStore.setState({
    sessionResolveQueueItems: {
      [SESSION_ID]: queue.map((entry) =>
        entry.thread.threadId === threadId
          ? {
              item: { ...entry.item, approvalState: 'accepted' },
              thread: { ...entry.thread, stage: 'approved' },
            }
          : entry,
      ),
    },
    reviewBulkAccepts: {
      [SESSION_ID]: { operationId: 'row-apply', itemIds: [target?.item.id ?? ''] },
    },
  });
};

describe('a comment fix ready on its row', () => {
  it('says Fix ready with the commit and opens the diff under the row on Review', async () => {
    await mount({ name: 'resolve-fix-ready' });
    const item = rowAt({ index: 0 });

    expect(item.querySelector('[data-item-work-word]')?.textContent).toBe('Fix ready');
    const review = within(item).getByRole('button', { name: 'Review' });
    fireEvent.click(review);

    expect(review.getAttribute('aria-expanded')).toBe('true');
    const panel = within(item).getByRole('region', { name: 'Proposed fix' });
    within(panel).getByRole('button', { name: 'Apply' });
    within(panel).getByRole('button', { name: 'Retry with a hint' });
    within(panel).getByRole('button', { name: 'Discard' });
    fireEvent.click(review);
    expect(within(item).queryByRole('region', { name: 'Proposed fix' })).toBeNull();
  });

  it('applies the fix of that comment only, once while it is pending, with the undo bar after', async () => {
    let settle: () => void = () => undefined;
    const acceptReviewComments = vi.fn<StoreState['acceptReviewComments']>(
      () =>
        new Promise((resolve) => {
          settle = () => resolve({ acceptedCount: 1, failures: [] });
        }),
    );
    const undoReviewAccepts = vi.fn<StoreState['undoReviewAccepts']>(async () => true);
    stub({ acceptReviewComments, undoReviewAccepts });
    await mount({ name: 'resolve-fix-ready' });
    const threadId = threadOf({ index: 0 });
    const apply = within(rowAt({ index: 0 })).getByRole('button', { name: 'Apply' });

    fireEvent.click(apply);
    await waitFor(() => expect(apply.getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(apply);
    expect(acceptReviewComments).toHaveBeenCalledOnce();
    expect(acceptReviewComments).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      threadIds: [threadId],
    });

    await act(async () => {
      markApplied({ threadId });
      settle();
    });
    const applied = list().querySelector(`[data-thread-id="${threadId}"]`)?.closest('li');
    expect(applied?.querySelector('[data-item-work-word]')?.textContent).toBe(
      'Applied, not pushed',
    );
    const bar = screen.getByText('1 accepted').closest<HTMLElement>('[role="status"]');
    fireEvent.click(within(bar ?? document.body).getByRole('button', { name: /^Undo/ }));
    await waitFor(() => expect(undoReviewAccepts).toHaveBeenCalledWith({ sessionId: SESSION_ID }));
  });

  it('discards the fix of that comment, naming it, and ignores a second click while pending', async () => {
    const discardProposedFix = vi.fn<StoreState['discardProposedFix']>(
      () => new Promise<void>(() => undefined),
    );
    stub({ discardProposedFix });
    await mount({ name: 'resolve-fix-ready' });
    const item = rowAt({ index: 0 });
    const threadId = threadOf({ index: 0 });
    fireEvent.click(within(item).getByRole('button', { name: 'Review' }));
    const discard = within(item).getByRole('button', { name: 'Discard' });

    fireEvent.click(discard);
    await waitFor(() => expect(discard.getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(discard);

    expect(discardProposedFix).toHaveBeenCalledOnce();
    expect(discardProposedFix.mock.calls[0]?.[0]).toMatchObject({
      sessionId: SESSION_ID,
      threadId,
    });
    const applies = within(item).getAllByRole('button', { name: 'Apply' });
    expect(applies.every((button) => button.hasAttribute('disabled'))).toBe(true);
  });

  it('keeps the row as it was and logs the failure when the discard fails', async () => {
    const discardProposedFix = vi.fn<StoreState['discardProposedFix']>(async () => {
      throw new Error('This fix was made in another worktree');
    });
    const reportError = vi.fn<StoreState['reportError']>(async () => undefined);
    stub({ discardProposedFix, reportError });
    await mount({ name: 'resolve-fix-ready' });
    const item = rowAt({ index: 0 });
    fireEvent.click(within(item).getByRole('button', { name: 'Review' }));

    fireEvent.click(within(item).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(reportError).toHaveBeenCalledOnce());
    expect(reportError.mock.calls[0]?.[0]).toMatchObject({ title: "Couldn't discard the fix" });
    expect(item.querySelector('[data-item-work-word]')?.textContent).toBe('Fix ready');
  });
});

describe('a comment fix that failed on its row', () => {
  it('retries in the same run from the row, once while it is pending', async () => {
    const retryCouldntFix = vi.fn<StoreState['retryCouldntFix']>(
      () => new Promise<void>(() => undefined),
    );
    stub({ retryCouldntFix });
    await mount({ name: 'resolve-fix-failed' });
    const failed = Array.from(list().querySelectorAll<HTMLElement>('li')).find(
      (candidate) => candidate.querySelector('[data-item-work-word]')?.textContent === 'Failed',
    );
    if (failed === undefined) {
      throw new Error('no failed row');
    }
    const threadId = failed.querySelector('[data-thread-id]')?.getAttribute('data-thread-id');
    const retry = within(failed).getByRole('button', { name: 'Retry' });

    fireEvent.click(retry);
    await waitFor(() => expect(retry.getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(retry);

    expect(retryCouldntFix).toHaveBeenCalledOnce();
    expect(retryCouldntFix.mock.calls[0]?.[0]).toMatchObject({
      sessionId: SESSION_ID,
      threadIds: [threadId],
    });
    expect(failed.querySelector('[data-item-work-word]')?.textContent).toBe('Starting');
    within(failed).getByRole('button', { name: 'Fix actions' });
  });
});
