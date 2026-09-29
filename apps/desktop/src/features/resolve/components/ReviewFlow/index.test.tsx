// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
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
import { ToastProvider } from '../../../../app/components/Toast';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { ReviewFlow } from './index';

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

const stub = (actions: Partial<StoreState>): void => {
  const state = useAppStore.getState();
  restore = {
    ...Object.fromEntries(Object.keys(actions).map((key) => [key, state[key as keyof StoreState]])),
    ...restore,
  };
  useAppStore.setState(actions);
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async ({ threadId }: { readonly threadId: string | null }): Promise<void> => {
  seedResolveScene({ expandedThreadId: threadId });
  render(
    <ToastProvider>
      <ReviewFlow session={SESSION} />
    </ToastProvider>,
  );
  await settle();
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const row = (name: RegExp): HTMLElement =>
  within(list())
    .getAllByRole('button')
    .find((candidate) => name.test(candidate.textContent ?? '')) ??
  (() => {
    throw new Error(`no row ${String(name)}`);
  })();

const comment = (): HTMLElement => screen.getByRole('article', { name: 'Comment' });

const focusedThread = (): string | null => comment().getAttribute('data-review-comment');

const press = (key: string, code: string, init: KeyboardEventInit = {}): void => {
  fireEvent.keyDown(document.activeElement ?? list(), { key, code, ...init });
};

describe('Review as one flow', () => {
  it('shows the list and the focused comment side by side, with no drawer', async () => {
    await mount({ threadId: EXPANDED_THREAD_ID });

    expect(within(list()).getByRole('region', { name: 'Open' })).toBeDefined();
    expect(within(list()).getByRole('region', { name: 'Waiting for the push' })).toBeDefined();
    expect(within(list()).getByRole('region', { name: 'Done' })).toBeDefined();
    expect(focusedThread()).toBe(EXPANDED_THREAD_ID);
    expect(screen.queryByRole('complementary', { name: 'Conversation' })).toBeNull();
    expect(document.querySelector('[data-conversation-slot]')).toBeNull();
    expect(within(comment()).getByRole('button', { name: /^Accept/ })).toBeDefined();
  });

  it('names every state with its own word and never says Resolve on a control', async () => {
    await mount({ threadId: null });

    const words = within(list())
      .getAllByRole('button')
      .map((button) => button.textContent ?? '');
    expect(words.some((text) => text.includes('Ready'))).toBe(true);
    expect(words.some((text) => text.includes('Needs you'))).toBe(true);
    expect(words.some((text) => text.includes('Drafting'))).toBe(true);
    expect(words.some((text) => text.includes('Not started'))).toBe(true);
    expect(words.some((text) => text.includes('Skipped'))).toBe(true);
    expect(words.some((text) => text.includes('Pushed'))).toBe(true);
    const labels = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(labels.filter((label) => /^Resolve\b/.test(label))).toEqual([]);
  });

  it('never starts an agent by opening Review, and drafts the new ones in one click', async () => {
    const spawnAgent = vi.fn(async () => undefined);
    stub({ spawnAgent: spawnAgent as unknown as StoreState['spawnAgent'] });
    await mount({ threadId: null });

    expect(spawnAgent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Draft a fix/ }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
  });

  it('accepts with A: marks it, publishes nothing, and moves to the next open comment', async () => {
    const accept = vi.fn(async () => undefined);
    const publish = vi.fn(async () => undefined);
    stub({
      acceptResolveQueueItem: accept as unknown as StoreState['acceptResolveQueueItem'],
      publishConversations: publish as unknown as StoreState['publishConversations'],
    });
    await mount({ threadId: EXPANDED_THREAD_ID });

    row(/retryPolicy\.ts:42/).focus();
    press('a', 'KeyA');

    await waitFor(() => expect(accept).toHaveBeenCalledOnce());
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION.id, revision: 1, reply: expect.any(String) }),
    );
    expect(publish).not.toHaveBeenCalled();
    await waitFor(() => expect(focusedThread()).not.toBe(EXPANDED_THREAD_ID));
  });

  it('moves with J and K while the list has focus', async () => {
    await mount({ threadId: EXPANDED_THREAD_ID });
    row(/retryPolicy\.ts:42/).focus();

    press('j', 'KeyJ');
    await settle();
    const second = focusedThread();
    expect(second).not.toBe(EXPANDED_THREAD_ID);
    press('k', 'KeyK');
    await settle();
    expect(focusedThread()).toBe(EXPANDED_THREAD_ID);
  });

  it('replies without a change from one text box: R, type, Enter', async () => {
    const refuse = vi.fn(async () => undefined);
    stub({ refuseResolveQueueItem: refuse as unknown as StoreState['refuseResolveQueueItem'] });
    await mount({ threadId: EXPANDED_THREAD_ID });

    row(/retryPolicy\.ts:42/).focus();
    press('r', 'KeyR');
    const box = await within(comment()).findByRole('textbox', { name: 'Your reply' });
    fireEvent.change(box, { target: { value: 'We keep the cap at 6 on purpose.' } });
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(refuse).toHaveBeenCalledOnce());
    expect(refuse).toHaveBeenCalledWith(
      expect.objectContaining({ reply: 'We keep the cap at 6 on purpose.', revision: 1 }),
    );
  });

  it('skips with S and undoes a skip from the waiting group', async () => {
    const defer = vi.fn(async () => undefined);
    const takeUp = vi.fn(async () => undefined);
    stub({
      deferResolveQueueItem: defer as unknown as StoreState['deferResolveQueueItem'],
      takeUpResolveQueueItem: takeUp as unknown as StoreState['takeUpResolveQueueItem'],
    });
    await mount({ threadId: EXPANDED_THREAD_ID });

    row(/retryPolicy\.ts:42/).focus();
    press('s', 'KeyS');
    await waitFor(() => expect(defer).toHaveBeenCalledOnce());

    fireEvent.click(row(/Skipped/));
    await settle();
    fireEvent.click(within(comment()).getByRole('button', { name: /^Undo/ }));
    await waitFor(() => expect(takeUp).toHaveBeenCalledOnce());
  });

  it('answers the agent with E on a comment that needs you', async () => {
    await mount({ threadId: null });
    fireEvent.click(row(/Needs you/));
    await settle();
    row(/Needs you/).focus();
    press('e', 'KeyE');

    expect(await within(comment()).findByRole('textbox', { name: 'Your answer' })).toBeDefined();
    fireEvent.keyDown(within(comment()).getByRole('textbox', { name: 'Your answer' }), {
      key: 'Escape',
      code: 'Escape',
    });
    await settle();
    expect(within(comment()).queryByRole('textbox', { name: 'Your answer' })).toBeNull();
  });

  it('keeps Stop drafting and Agent transcript in the menu of a drafting comment', async () => {
    await mount({ threadId: null });
    fireEvent.click(row(/Drafting/));
    await settle();

    expect(within(comment()).queryAllByRole('button', { name: /^Accept|^Edit|^Reply/ })).toEqual(
      [],
    );
    fireEvent.click(within(comment()).getByRole('button', { name: 'Comment actions' }));
    expect(await screen.findByRole('menuitem', { name: /Stop drafting/ })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /Agent transcript/ })).toBeDefined();
  });

  it('opens the not started comment with Draft a fix as its one primary', async () => {
    await mount({ threadId: 'PRRT_thread_retry_constant' });

    const verbs = within(comment())
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-review-verb'))
      .map((button) => button.getAttribute('data-review-verb'));
    expect(verbs).toEqual(['reviewComment.draft', 'reviewComment.reply', 'reviewComment.skip']);
  });

  it('pushes once from the header: confirm names what goes out, then one result line', async () => {
    const preview = {
      publicationId: 'pub-318',
      repo: 'harborline/payments-api',
      prNumber: 318,
      branch: 'hl/fix-duplicate-credit',
      localHead: 'a41c9e2aaaa',
      remoteHead: '7d02b11bbbb',
      requiresPush: true,
      frozenAt: 1,
      commits: [
        {
          sha: 'a41c9e2aaaa',
          shortSha: 'a41c9e2',
          subject: 'Redact the webhook payload',
          author: 'resolver',
          timestamp: 1,
          pushed: false,
          parentSha: null,
          threadIds: ['PRRT_thread_log_redact'],
        },
      ],
      unapproved: [],
      replies: [
        { threadId: 'PRRT_thread_log_redact', body: 'Redacted.', revision: 1, closes: true },
      ],
      notes: [],
      excluded: [],
      drift: [],
      blocker: null,
    };
    const prepare = vi.fn(async () => preview);
    const publish = vi.fn(async () => ({
      kind: 'done' as const,
      pushed: true,
      pushedHead: 'a41c9e2aaaa',
      total: 1,
      replies: 1,
      replied: 1,
      closed: 1,
      resolved: 1,
      leftOpen: 0,
      failed: 0,
      error: null,
    }));
    stub({
      preparePublication: prepare as unknown as StoreState['preparePublication'],
      publishConversations: publish as unknown as StoreState['publishConversations'],
    });
    await mount({ threadId: EXPANDED_THREAD_ID });

    fireEvent.click(screen.getByRole('button', { name: /^Push 1/ }));
    const confirm = await screen.findByRole('group', {
      name: 'Push 1 to hl/fix-duplicate-credit?',
    });
    expect(
      within(confirm).getByText(/1 fix in 1 new commit, 1 reply, 1 thread resolved/),
    ).toBeDefined();
    expect(publish).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Push' }));

    await waitFor(() =>
      expect(publish).toHaveBeenCalledWith({
        sessionId: SESSION.id,
        publicationId: 'pub-318',
      }),
    );
    expect(
      await screen.findByText('Pushed a41c9e2, 1 reply posted, 1 thread resolved on GitHub.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Review publication' })).toBeNull();
  });

  it('focuses the first present thread of a selection target and keeps the set', async () => {
    await mount({ threadId: null });
    const selection = ['PRRT_thread_gone', 'PRRT_thread_error_shape', EXPANDED_THREAD_ID];

    await act(async () => {
      await useAppStore.getState().openReviewTarget({
        sessionId: SESSION.id,
        destination: { kind: 'threads', threadIds: selection },
      });
    });
    await settle();

    expect(focusedThread()).toBe('PRRT_thread_error_shape');
    expect(useAppStore.getState().reviewTargets[SESSION.id]).toBeNull();
    expect(useAppStore.getState().reviewSelections[SESSION.id]).toEqual(selection);
  });
});
