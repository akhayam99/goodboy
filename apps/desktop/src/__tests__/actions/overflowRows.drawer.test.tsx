// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { ToastProvider } from '../../shared/components/Toast';
import {
  SESSION,
  THREAD_IDS,
  seedResolveScene,
  type ReplyOnlyVariant,
} from '../../app/components/MockScene/scenes/resolveSeed';
import { DrawerHost } from '../../app/components/DrawerHost';
import { BranchPage } from '../../features/branch/components/BranchPage';
import { BAR_COPY } from '../../features/resolve/commentStateCopy';

const MAX_OVERFLOW_ROWS = 5;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    worktree_diff_range: '',
    db_execute: { rowsAffected: 1, lastInsertId: 0 },
  });
});

afterEach(cleanup);

const page = () => (
  <ToastProvider>
    <BranchPage session={SESSION} workingDir={null} />
    <DrawerHost />
  </ToastProvider>
);

type MountParams = {
  readonly threadId: string | null;
  readonly replyOnly?: ReplyOnlyVariant;
};

const mountThread = async ({ threadId, replyOnly }: MountParams): Promise<void> => {
  seedResolveScene({ expandedThreadId: threadId, replyOnly });
  render(page());
  await screen.findByRole('navigation', { name: 'Comments' });
  if (threadId !== null) {
    await waitFor(() =>
      expect(document.querySelector('[data-slot="review-comment-drawer"]')).not.toBeNull(),
    );
  }
};

const threadIds = async (): Promise<ReadonlyArray<string>> => {
  await mountThread({ threadId: null });
  const ids = Array.from(
    screen
      .getByRole('navigation', { name: 'Comments' })
      .querySelectorAll<HTMLElement>('button[data-thread-id]'),
  ).flatMap((row) => (row.dataset.threadId === undefined ? [] : [row.dataset.threadId]));
  cleanup();
  return ids;
};

describe('the comment drawer ⋯ holds at most five rows in any one state', () => {
  it('draws at most five rows for every comment of the review scene', async () => {
    const ids = await threadIds();
    expect(ids.length).toBeGreaterThan(5);
    let opened = 0;
    for (const threadId of ids) {
      cleanup();
      await mountThread({ threadId });
      const drawer = document.querySelector<HTMLElement>('[data-slot="review-comment-drawer"]');
      const trigger =
        drawer === null ? null : within(drawer).queryByRole('button', { name: BAR_COPY.more });
      if (trigger === null) {
        continue;
      }
      fireEvent.click(trigger);
      opened += 1;
      const rows = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
      expect(rows.length, `${threadId}: ${rows.join(' | ')}`).toBeLessThanOrEqual(
        MAX_OVERFLOW_ROWS,
      );
    }
    expect(opened).toBeGreaterThan(3);
  });

  it.each<ReplyOnlyVariant>(['bundled', 'alone', 'posted'])(
    'draws at most five rows for a reply-only draft, %s',
    async (replyOnly) => {
      await mountThread({ threadId: THREAD_IDS.retryConstant, replyOnly });
      const drawer = document.querySelector<HTMLElement>('[data-slot="review-comment-drawer"]');
      const trigger =
        drawer === null ? null : within(drawer).queryByRole('button', { name: BAR_COPY.more });
      expect(trigger).not.toBeNull();
      if (trigger === null) {
        return;
      }
      fireEvent.click(trigger);
      const rows = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
      expect(rows.length, rows.join(' | ')).toBeLessThanOrEqual(MAX_OVERFLOW_ROWS);
    },
  );
});
