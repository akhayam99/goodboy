// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ResolvePublicationPreview } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  SESSION,
  THREAD_IDS,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { seedCommentsScene } from '../../../../app/components/MockScene/scenes/u23/commentsSeed';
import { PUSH_MISSING } from '../../../resolve/reviewPushCopy';
import { BranchPage } from '.';
import { DrawerHost } from '../../../../app/components/DrawerHost';

type StoreState = ReturnType<StoryStore['getState']>;
type Outcome = Awaited<ReturnType<StoreState['publishConversations']>>;

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

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async ({ threadId }: { readonly threadId: string | null }): Promise<void> => {
  seedResolveScene({ expandedThreadId: threadId });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
      <DrawerHost />
    </ToastProvider>,
  );
  await settle();
};

const selectReady = (): string => {
  const ready = within(list()).getByRole('region', { name: 'Ready to push' });
  const row = ready.querySelector<HTMLElement>('button[data-thread-id]');
  if (row === null) {
    throw new Error('no ready row');
  }
  fireEvent.click(row);
  return row.dataset.threadId ?? '';
};

const mountReady = async (): Promise<void> => {
  seedCommentsScene({ variant: 'ready-to-push' });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
      <DrawerHost />
    </ToastProvider>,
  );
  await settle();
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const bar = (): HTMLElement => screen.getByRole('toolbar', { name: 'Comment actions' });

const headerPush = (name: RegExp): HTMLElement =>
  screen.getAllByRole('button', { name }).find((button) => !list().contains(button)) ??
  (() => {
    throw new Error(`no header button ${String(name)}`);
  })();

const PUBLICATION_ID = 'pub-318';

const CLEAN: ResolvePublicationPreview = {
  publicationId: PUBLICATION_ID,
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
      threadIds: [THREAD_IDS.logRedact],
    },
  ],
  unapproved: [],
  replies: [{ threadId: THREAD_IDS.logRedact, body: 'Redacted.', revision: 1, closes: true }],
  notes: [],
  excluded: [],
  drift: [],
  blocker: null,
};

const DIRTY: ResolvePublicationPreview = {
  ...CLEAN,
  earlierCommits: [
    {
      sha: '9e4f1c2bbbb',
      shortSha: '9e4f1c2',
      subject: 'Batch the ledger lookups',
      author: 'resolver',
      timestamp: 0,
      pushed: false,
      parentSha: null,
    },
  ],
};

const DONE: Outcome = {
  kind: 'done',
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
};

type Deferred = {
  readonly promise: Promise<Outcome>;
  readonly resolve: (outcome: Outcome) => void;
};

const deferred = (): Deferred => {
  let resolve: (outcome: Outcome) => void = () => undefined;
  const promise = new Promise<Outcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const stubPush = ({
  preview,
  publish,
}: {
  readonly preview: ResolvePublicationPreview;
  readonly publish: StoreState['publishConversations'];
}) => {
  const prepare = vi.fn<StoreState['preparePublication']>(async () => preview);
  const publishMock = vi.fn<StoreState['publishConversations']>(publish);
  const cancel = vi.fn<StoreState['cancelPublication']>(async () => undefined);
  const state = useAppStore.getState();
  restore = {
    preparePublication: state.preparePublication,
    publishConversations: state.publishConversations,
    cancelPublication: state.cancelPublication,
  };
  useAppStore.setState({
    preparePublication: prepare,
    publishConversations: publishMock,
    cancelPublication: cancel,
  });
  return { prepare, publish: publishMock, cancel };
};

describe('one Push at a time', () => {
  it('pushes on one click when the preview needs no decision, busy in the header, then one outcome line', async () => {
    const gate = deferred();
    const { prepare, publish } = stubPush({ preview: CLEAN, publish: () => gate.promise });
    await mount({ threadId: null });

    fireEvent.click(headerPush(/^Push \d+ (fix|fixes)$/));

    await waitFor(() => expect(publish).toHaveBeenCalledOnce());
    expect(prepare).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith({ sessionId: SESSION.id, publicationId: PUBLICATION_ID });
    expect(screen.queryByRole('group', { name: /^Push \d+ commits? to/ })).toBeNull();
    const busy = headerPush(/^Pushing 1 fix$/);
    expect(busy.getAttribute('aria-busy')).toBe('true');

    await act(async () => gate.resolve(DONE));
    expect(
      await screen.findByText(
        'Pushed 1 commit to origin and posted 1 reply on GitHub. 1 thread resolved.',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Pushed 1 commit to origin/)).toBeNull();
  });

  it('opens the panel when the preview needs a decision, and the header does not push', async () => {
    const { publish, cancel } = stubPush({ preview: DIRTY, publish: async () => DONE });
    await mount({ threadId: null });

    const header = headerPush(/^Push \d+ (fix|fixes)$/);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(header);

    const panel = await screen.findByRole('group', {
      name: 'Push 2 commits to hl/fix-duplicate-credit?',
    });
    within(panel).getByText('Not a fix');
    expect(within(panel).getAllByRole('button', { name: 'Push' })).toHaveLength(1);
    expect(headerPush(/^Push \d+ (fix|fixes)$/).getAttribute('aria-expanded')).toBe('true');
    expect(publish).not.toHaveBeenCalled();

    fireEvent.click(headerPush(/^Push \d+ (fix|fixes)$/));
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: /^Push 2 commits to/ })).toBeNull(),
    );
    expect(publish).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith({ sessionId: SESSION.id, publicationId: PUBLICATION_ID });
    expect(headerPush(/^Push \d+ (fix|fixes)$/).getAttribute('aria-expanded')).toBe('false');
  });

  it('pushes once from the panel Push', async () => {
    const { publish } = stubPush({ preview: DIRTY, publish: async () => DONE });
    await mount({ threadId: null });

    fireEvent.click(headerPush(/^Push \d+ (fix|fixes)$/));
    const panel = await screen.findByRole('group', { name: /^Push 2 commits to/ });
    fireEvent.click(within(panel).getByRole('button', { name: 'Push' }));

    await waitFor(() => expect(publish).toHaveBeenCalledOnce());
    expect(await screen.findByText(/^Pushed 2 commits to origin and posted 1 reply/)).toBeDefined();
  });

  it('pushes once on a double click', async () => {
    const gate = deferred();
    const { prepare, publish } = stubPush({ preview: CLEAN, publish: () => gate.promise });
    await mount({ threadId: null });

    const header = headerPush(/^Push \d+ (fix|fixes)$/);
    fireEvent.click(header);
    fireEvent.click(header);
    await settle();

    expect(prepare).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledOnce();
    await act(async () => gate.resolve(DONE));
  });

  it('keeps the header Push on every ready comment whatever is selected', async () => {
    const { prepare } = stubPush({ preview: CLEAN, publish: async () => DONE });
    await mountReady();

    const label = headerPush(/^Push \d+ (fix|fixes)$/).textContent ?? '';
    const ready = within(list()).getByRole('region', { name: 'Ready to push' });
    const count = Number(/(\d+)/.exec(ready.textContent ?? '')?.[1] ?? 0);
    expect(label).toBe(`Push ${count} ${count === 1 ? 'fix' : 'fixes'}`);
    expect(count).toBe(3);

    fireEvent.click(headerPush(/^Push \d+ (fix|fixes)$/));
    await waitFor(() => expect(prepare).toHaveBeenCalledOnce());
    expect(prepare).toHaveBeenLastCalledWith({ sessionId: SESSION.id });
  });

  it('pushes only the selected comment from its own detail', async () => {
    const { prepare } = stubPush({ preview: DIRTY, publish: async () => DONE });
    await mountReady();
    const threadId = selectReady();
    await settle();

    fireEvent.click(within(bar()).getByRole('button', { name: 'Push only this one' }));

    await waitFor(() => expect(prepare).toHaveBeenCalledOnce());
    expect(prepare).toHaveBeenLastCalledWith({
      sessionId: SESSION.id,
      threadIds: [threadId],
      isolated: true,
    });
    const panel = await screen.findByRole('group', { name: /^Push 2 commits to/ });
    within(panel).getByText('Not a fix');
    within(panel).getByText('Batch the ledger lookups');
    expect(screen.queryByRole('button', { name: 'Push only this one' })).toBeNull();
    expect(within(panel).getAllByRole('button', { name: 'Push' })).toHaveLength(1);
  });

  it('closes the prepared publication when the page goes away with the panel open', async () => {
    const { publish, cancel } = stubPush({ preview: DIRTY, publish: async () => DONE });
    await mount({ threadId: null });

    fireEvent.click(headerPush(/^Push \d+ (fix|fixes)$/));
    await screen.findByRole('group', { name: /^Push 2 commits to/ });
    cleanup();

    expect(cancel).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith({ sessionId: SESSION.id, publicationId: PUBLICATION_ID });
    expect(publish).not.toHaveBeenCalled();
  });

  it('says the push was already handled when the publication is gone', async () => {
    const { cancel } = stubPush({ preview: DIRTY, publish: async () => ({ kind: 'missing' }) });
    await mount({ threadId: null });

    fireEvent.click(headerPush(/^Push \d+ (fix|fixes)$/));
    const panel = await screen.findByRole('group', { name: /^Push 2 commits to/ });
    fireEvent.click(within(panel).getByRole('button', { name: 'Push' }));

    expect(await screen.findByText(PUSH_MISSING)).toBeDefined();
    expect(screen.queryByRole('group', { name: /^Push 2 commits to/ })).toBeNull();
    expect(cancel).toHaveBeenCalledWith({ sessionId: SESSION.id, publicationId: PUBLICATION_ID });
  });

  it('says what changed above the refreshed panel when the push is stale', async () => {
    const moved: ResolvePublicationPreview = {
      ...DIRTY,
      drift: [{ kind: 'remote_moved', threadId: null, before: '7d02b11', after: 'c5d9e08' }],
    };
    const { publish } = stubPush({
      preview: DIRTY,
      publish: async () => ({ kind: 'stale', preview: moved }),
    });
    await mount({ threadId: null });

    fireEvent.click(headerPush(/^Push \d+ (fix|fixes)$/));
    const panel = await screen.findByRole('group', { name: /^Push 2 commits to/ });
    fireEvent.click(within(panel).getByRole('button', { name: 'Push' }));

    const line = await screen.findByText('The remote moved from 7d02b11 to c5d9e08.', {
      selector: '[role="status"]',
    });
    const refreshed = screen.getByRole('group', { name: /^Push 2 commits to/ });
    expect(line.compareDocumentPosition(refreshed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(publish).toHaveBeenCalledOnce();
  });
});
