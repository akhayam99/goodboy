// @vitest-environment happy-dom

const diffRanges: Array<(raw: string) => void> = [];

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) =>
    cmd === 'worktree_diff_range'
      ? new Promise<string>((resolve) => {
          diffRanges.push(resolve);
        })
      : new Promise<never>(() => undefined),
  ),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  THREAD_IDS,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { DrawerHost } from '../../../../app/components/DrawerHost';
import { captureWindowLocation } from '../../../../store/slices/navigation/captureWindowLocation';
import { BranchPage } from '../../../branch/components/BranchPage';

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  diffRanges.length = 0;
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

type StubParams = {
  readonly defer: StoreState['deferResolveQueueItem'];
};

const stubDefer = ({ defer }: StubParams): void => {
  restore = { deferResolveQueueItem: useAppStore.getState().deferResolveQueueItem };
  useAppStore.setState({ deferResolveQueueItem: defer });
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const page = () => (
  <ToastProvider>
    <BranchPage session={SESSION} workingDir={null} />
    <DrawerHost />
  </ToastProvider>
);

type MountParams = {
  readonly threadId: string | null;
};

const mount = async ({ threadId }: MountParams): Promise<void> => {
  seedResolveScene({ expandedThreadId: threadId });
  render(page());
  await settle();
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

type RowParams = {
  readonly threadId: string;
};

const rowOf = ({ threadId }: RowParams): HTMLElement =>
  list().querySelector<HTMLElement>(`button[data-thread-id="${threadId}"]`) ??
  (() => {
    throw new Error(`no row ${threadId}`);
  })();

const drawer = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-slot="review-comment-drawer"] section');

const section = (): HTMLElement =>
  drawer() ??
  (() => {
    throw new Error('no comment drawer');
  })();

const openThread = (): string | null => {
  const open = useAppStore.getState().drawer;
  return open?.kind === 'conversation' ? open.payload.threadId : null;
};

const drawnThread = (): string | null =>
  document.querySelector('[data-review-drawer]')?.getAttribute('data-review-drawer') ?? null;

const actions = (): HTMLElement => screen.getByRole('toolbar', { name: 'Comment actions' });

type KeyParams = {
  readonly key: string;
  readonly code: string;
};

const press = ({ key, code }: KeyParams): void => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key, code });
};

describe('the comment drawer', () => {
  it('opens from a full width row and closes with Escape back on the row', async () => {
    await mount({ threadId: null });
    expect(drawer()).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Comment actions' })).toBeNull();

    fireEvent.click(rowOf({ threadId: THREAD_IDS.retryConstant }));
    await settle();

    expect(openThread()).toBe(THREAD_IDS.retryConstant);
    expect(drawnThread()).toBe(THREAD_IDS.retryConstant);
    expect(useAppStore.getState().branchThreadId[SESSION.id]).toBe(THREAD_IDS.retryConstant);
    expect(rowOf({ threadId: THREAD_IDS.retryConstant }).getAttribute('aria-current')).toBe('true');
    const body = within(section()).getByRole('article', { name: 'Comment' });
    expect(body.compareDocumentPosition(actions()) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    press({ key: 'Escape', code: 'Escape' });
    await settle();
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    expect(openThread()).toBeNull();
    expect(drawer()).toBeNull();
    expect(useAppStore.getState().branchThreadId[SESSION.id] ?? null).toBeNull();
    expect(document.activeElement).toBe(rowOf({ threadId: THREAD_IDS.retryConstant }));
  });

  it('holds Fix as the primary and Reply and Skip as visible verbs, each with its key', async () => {
    await mount({ threadId: THREAD_IDS.retryConstant });

    const verbs = within(actions()).getAllByRole('button');
    const fix = verbs.find((button) => button.dataset.reviewVerb === 'reviewComment.draft');
    const reply = verbs.find((button) => button.dataset.reviewVerb === 'reviewComment.reply');
    const skip = verbs.find((button) => button.dataset.reviewVerb === 'reviewComment.skip');
    expect(fix?.textContent).toBe('FixF');
    expect(reply?.textContent).toBe('ReplyR');
    expect(skip?.textContent).toBe('SkipS');
    expect(verbs.at(-1)).toBe(fix);
    expect(
      document.querySelector('[data-review-action-bar]')?.closest('[data-slot="form-actions"]'),
    ).not.toBeNull();
  });

  it('opens the Fix comments drawer on this comment from Fix', async () => {
    await mount({ threadId: THREAD_IDS.retryConstant });

    fireEvent.click(within(actions()).getByRole('button', { name: /^Fix/ }));
    await settle();

    const open = useAppStore.getState().drawer;
    expect(open?.kind).toBe('fix-comments');
    expect(open?.kind === 'fix-comments' ? open.payload.threadIds : null).toEqual([
      THREAD_IDS.retryConstant,
    ]);
  });

  it('goes back from the Fix comments drawer to the comment it came from', async () => {
    await mount({ threadId: THREAD_IDS.retryConstant });

    fireEvent.click(within(actions()).getByRole('button', { name: /^Fix/ }));
    await settle();
    const fixing = useAppStore.getState().drawer;
    expect(fixing?.kind === 'fix-comments' ? fixing.payload.fromThreadId : null).toBe(
      THREAD_IDS.retryConstant,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to the comment' }));
    await settle();

    expect(openThread()).toBe(THREAD_IDS.retryConstant);
    expect(useAppStore.getState().branchThreadId[SESSION.id]).toBe(THREAD_IDS.retryConstant);
  });

  it('opens the reply field in the drawer from Reply and from R', async () => {
    await mount({ threadId: THREAD_IDS.retryConstant });

    fireEvent.click(within(actions()).getByRole('button', { name: /^Reply/ }));
    await settle();
    const field = within(section()).getByRole('textbox');
    expect(field).toBeDefined();
    fireEvent.keyDown(field, { key: 'Escape', code: 'Escape' });
    await settle();
    expect(within(section()).queryByRole('textbox')).toBeNull();

    section().focus();
    press({ key: 'r', code: 'KeyR' });
    await settle();
    expect(within(section()).getByRole('textbox')).toBeDefined();
  });

  it('skips from the drawer and moves to the next open comment', async () => {
    const deferResolveQueueItem = vi.fn<StoreState['deferResolveQueueItem']>(async () => undefined);
    stubDefer({ defer: deferResolveQueueItem });
    await mount({ threadId: THREAD_IDS.retryConstant });

    fireEvent.click(within(actions()).getByRole('button', { name: /^Skip/ }));
    await settle();

    expect(deferResolveQueueItem).toHaveBeenCalledOnce();
    expect(openThread()).not.toBeNull();
    expect(openThread()).not.toBe(THREAD_IDS.retryConstant);
  });

  it('shows a failed verb inline in the drawer and retries it from the verb', async () => {
    const deferResolveQueueItem = vi
      .fn<StoreState['deferResolveQueueItem']>()
      .mockRejectedValueOnce(new Error('The queue is locked'))
      .mockResolvedValueOnce(undefined);
    stubDefer({ defer: deferResolveQueueItem });
    await mount({ threadId: THREAD_IDS.retryConstant });

    fireEvent.click(within(actions()).getByRole('button', { name: /^Skip/ }));
    await settle();

    const alert = within(section()).getByRole('alert');
    expect(alert.textContent).toContain('The queue is locked');
    expect(alert.closest('[data-slot="form-actions"]')).not.toBeNull();
    expect(openThread()).toBe(THREAD_IDS.retryConstant);
    const retry = within(actions()).getByRole('button', { name: /^Retry/ });
    expect(retry.dataset.reviewVerb).toBe('reviewComment.skip');

    fireEvent.click(retry);
    await settle();

    expect(deferResolveQueueItem).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('The queue is locked')).toBeNull();
  });

  it('moves through the shown comments with J and K and the arrows while it is open', async () => {
    await mount({ threadId: null });
    const ids = Array.from(list().querySelectorAll<HTMLElement>('button[data-thread-id]')).map(
      (row) => row.dataset.threadId ?? '',
    );
    const [first, second, third] = ids;
    fireEvent.click(rowOf({ threadId: first ?? '' }));
    await settle();
    expect(drawer()?.textContent).toContain(`1 of ${ids.length}`);

    press({ key: 'j', code: 'KeyJ' });
    await settle();
    expect(drawnThread()).toBe(second);
    expect(drawer()?.contains(document.activeElement)).toBe(true);

    press({ key: 'ArrowDown', code: 'ArrowDown' });
    await settle();
    expect(drawnThread()).toBe(third);
    expect(drawer()?.textContent).toContain(`3 of ${ids.length}`);

    press({ key: 'k', code: 'KeyK' });
    await settle();
    press({ key: 'ArrowUp', code: 'ArrowUp' });
    await settle();
    expect(drawnThread()).toBe(first);
    expect(rowOf({ threadId: first ?? '' }).getAttribute('aria-current')).toBe('true');
  });

  it('keeps the open comment when the list refreshes and after a window reload', async () => {
    await mount({ threadId: null });
    fireEvent.click(rowOf({ threadId: EXPANDED_THREAD_ID }));
    await settle();
    expect(drawnThread()).toBe(EXPANDED_THREAD_ID);

    act(() => {
      const state = useAppStore.getState();
      useAppStore.setState({
        sessionResolveQueueItems: {
          ...state.sessionResolveQueueItems,
          [SESSION.id]: (state.sessionResolveQueueItems[SESSION.id] ?? []).map((item) => ({
            ...item,
          })),
        },
      });
    });
    await settle();
    expect(drawnThread()).toBe(EXPANDED_THREAD_ID);

    const location = captureWindowLocation({ state: useAppStore.getState() });
    cleanup();
    seedResolveScene({ expandedThreadId: null });
    act(() => {
      useAppStore.getState().restoreLocation({ location });
    });
    render(page());
    await settle();

    expect(drawnThread()).toBe(EXPANDED_THREAD_ID);
    expect(rowOf({ threadId: EXPANDED_THREAD_ID }).getAttribute('aria-current')).toBe('true');
  });

  it('stays on the comment you moved to when a Skip on the one you left lands late', async () => {
    let finishSkip: () => void = () => undefined;
    const deferResolveQueueItem = vi.fn<StoreState['deferResolveQueueItem']>(
      () =>
        new Promise<void>((resolve) => {
          finishSkip = resolve;
        }),
    );
    stubDefer({ defer: deferResolveQueueItem });
    await mount({ threadId: THREAD_IDS.retryConstant });

    fireEvent.click(within(actions()).getByRole('button', { name: /^Skip/ }));
    section().focus();
    press({ key: 'j', code: 'KeyJ' });
    await settle();
    const movedTo = drawnThread();
    expect(movedTo).not.toBe(THREAD_IDS.retryConstant);

    await act(async () => {
      finishSkip();
    });
    await settle();

    expect(drawnThread()).toBe(movedTo);
  });

  it('drops a late change load for the comment it already left', async () => {
    await mount({ threadId: EXPANDED_THREAD_ID });
    await waitFor(() => expect(diffRanges.length).toBeGreaterThan(0));
    const [lateLoad] = diffRanges;

    section().focus();
    press({ key: 'j', code: 'KeyJ' });
    await settle();
    const next = drawnThread();
    expect(next).not.toBe(EXPANDED_THREAD_ID);

    await act(async () => {
      lateLoad?.(
        [
          'diff --git a/src/stale/lateLoad.ts b/src/stale/lateLoad.ts',
          '--- a/src/stale/lateLoad.ts',
          '+++ b/src/stale/lateLoad.ts',
          '@@ -1 +1 @@',
          '-const late = 1;',
          '+const late = 2;',
          '',
        ].join('\n'),
      );
    });
    await settle();

    expect(drawnThread()).toBe(next);
    expect(drawer()?.textContent ?? '').not.toContain('lateLoad.ts');
  });
});
