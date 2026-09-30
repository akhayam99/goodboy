// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Agent, AgentId, MountId, ResolveAttempt } from '@goodboy/types';
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
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { resolverBriefOf } from '../../../resolve/hooks/useResolverBrief';
import { AgentBriefResolver } from './AgentBriefResolver';

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

const SINGLE = 'agent-brief-single' as AgentId;
const CHILD = 'agent-brief-child' as AgentId;
const SIBLING = 'agent-brief-sibling' as AgentId;
const CHILD_MOUNT = 'mount-brief-child' as MountId;
const TYPO = 'PRRT_thread_typo';
const CONSTANT = 'PRRT_thread_retry_constant';

const attemptOf = ({
  id,
  agentId,
  threadIds,
  batchId,
  mountTarget = null,
}: {
  readonly id: string;
  readonly agentId: AgentId;
  readonly threadIds: ReadonlyArray<string>;
  readonly batchId: string | null;
  readonly mountTarget?: ResolveAttempt['mountTarget'];
}): ResolveAttempt => ({
  id,
  sessionId: SESSION.id,
  agentId,
  prNumber: 318,
  threadIds,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase: 'finished',
  mountTarget,
  startedAt: 1,
  endedAt: 2,
  error: null,
  createdAt: 1,
  batchId,
  copyPath: null,
  launchChoice: null,
});

const agentOf = (id: AgentId): Agent => ({
  id,
  sessionId: SESSION.id,
  ordinal: 1,
  name: 'resolve: comment',
  kind: 'resolver',
  status: 'completed',
});

const ATTEMPTS = [
  attemptOf({ id: 'a-single', agentId: SINGLE, threadIds: [EXPANDED_THREAD_ID], batchId: null }),
  attemptOf({
    id: 'a-child',
    agentId: CHILD,
    threadIds: [TYPO],
    batchId: 'batch-1',
    mountTarget: { mountId: CHILD_MOUNT, mountRevision: 1, worktreePath: '/repo/child' },
  }),
  attemptOf({ id: 'a-sibling', agentId: SIBLING, threadIds: [CONSTANT], batchId: 'batch-1' }),
];

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

const mount = async ({ agentId }: { readonly agentId: AgentId }): Promise<void> => {
  seedResolveScene({ expandedThreadId: null });
  useAppStore.setState({ sessionResolveAttempts: { [SESSION.id]: ATTEMPTS } });
  const brief = resolverBriefOf({ attempts: ATTEMPTS, agentId });
  if (brief === null) {
    throw new Error('no brief');
  }
  render(
    <ToastProvider>
      <AgentBriefResolver session={SESSION} agent={agentOf(agentId)} brief={brief} />
    </ToastProvider>,
  );
  await settle();
};

describe('the resolver Brief', () => {
  it('reads a single resolver as one comment, its fix and its reply', async () => {
    await mount({ agentId: SINGLE });

    const article = screen.getByRole('article', { name: 'Comment' });
    expect(within(article).getByRole('heading', { name: 'Comment' })).toBeDefined();
    expect(within(article).getByRole('heading', { name: 'Fix' })).toBeDefined();
    expect(within(article).getByRole('heading', { name: /^Reply/ })).toBeDefined();
    const verbs = within(article)
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-review-verb'))
      .map((button) => button.getAttribute('data-review-verb'));
    expect(verbs).toEqual([
      'reviewComment.accept',
      'reviewComment.edit',
      'reviewComment.reply',
      'reviewComment.skip',
    ]);
    expect(screen.queryByRole('button', { name: /Open in Review/ })).toBeNull();
  });

  it('accepts with the same call the Review page makes', async () => {
    const accept = vi.fn<StoreState['acceptResolveQueueItem']>(async () => undefined);
    stub({ acceptResolveQueueItem: accept });
    await mount({ agentId: SINGLE });

    fireEvent.click(screen.getByRole('button', { name: /^Accept/ }));

    await waitFor(() => expect(accept).toHaveBeenCalledOnce());
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION.id, revision: 1, reply: expect.any(String) }),
    );
  });

  it('replies without a change from the Brief and keeps the Brief open', async () => {
    const refuse = vi.fn<StoreState['refuseResolveQueueItem']>(async () => undefined);
    const navigate = vi.fn<StoreState['navigate']>();
    stub({ refuseResolveQueueItem: refuse, navigate });
    await mount({ agentId: SINGLE });

    fireEvent.click(screen.getByRole('button', { name: /^Reply/ }));
    const box = await screen.findByRole('textbox', { name: 'Your reply' });
    fireEvent.change(box, { target: { value: 'We keep the cap at 6 on purpose.' } });
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(refuse).toHaveBeenCalledOnce());
    expect(refuse).toHaveBeenCalledWith(
      expect.objectContaining({ reply: 'We keep the cap at 6 on purpose.', revision: 1 }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('takes the compose request of its own thread and leaves the others alone', async () => {
    await mount({ agentId: SINGLE });
    const dispatch = (threadId: string): boolean => {
      const event = new CustomEvent('goodboy:review-request', {
        detail: { sessionId: SESSION.id, request: { kind: 'compose', threadId, mode: 'reply' } },
        cancelable: true,
      });
      act(() => {
        window.dispatchEvent(event);
      });
      return event.defaultPrevented;
    };

    expect(dispatch(TYPO)).toBe(false);
    expect(screen.queryByRole('textbox', { name: 'Your reply' })).toBeNull();
    expect(dispatch(EXPANDED_THREAD_ID)).toBe(true);
    expect(await screen.findByRole('textbox', { name: 'Your reply' })).toBeDefined();
  });

  it('pushes only this fix and confirms inline', async () => {
    const preview = {
      publicationId: 'pub-brief',
      repo: 'harborline/payments-api',
      prNumber: 318,
      branch: 'hl/fix-duplicate-credit',
      localHead: 'c81e5aaaaaa',
      remoteHead: '7d02b11bbbb',
      requiresPush: true,
      frozenAt: 1,
      commits: [],
      unapproved: [],
      replies: [{ threadId: EXPANDED_THREAD_ID, body: 'Fixed.', revision: 1, closes: true }],
      notes: [],
      excluded: [],
      drift: [],
      blocker: null,
    };
    const prepare = vi.fn<StoreState['preparePublication']>(async () => preview);
    const publish = vi.fn<StoreState['publishConversations']>(async () => ({
      kind: 'done' as const,
      pushed: true,
      pushedHead: 'c81e5aaaaaa',
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
      preparePublication: prepare,
      publishConversations: publish,
    });
    await mount({ agentId: SINGLE });
    const items = useAppStore.getState().sessionResolveQueueItems[SESSION.id] ?? [];
    useAppStore.setState({
      sessionResolveQueueItems: {
        [SESSION.id]: items.map((entry) =>
          entry.thread.threadId === EXPANDED_THREAD_ID
            ? {
                item: { ...entry.item, approvalState: 'accepted', approvedRevision: 1 },
                thread: { ...entry.thread, stage: 'approved', commitShas: ['c81e5aaaaaa'] },
              }
            : entry,
        ),
      },
    });
    await settle();

    fireEvent.click(await screen.findByRole('button', { name: /Push now/ }));
    const confirm = await screen.findByRole('group', {
      name: 'Push 1 to hl/fix-duplicate-credit?',
    });
    expect(prepare).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      threadIds: [EXPANDED_THREAD_ID],
      isolated: true,
    });
    expect(publish).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Push' }));

    await waitFor(() =>
      expect(publish).toHaveBeenCalledWith({ sessionId: SESSION.id, publicationId: 'pub-brief' }),
    );
    expect(await screen.findByText(/Pushed c81e5aa, 1 reply posted/)).toBeDefined();
  });

  it('says plainly which earlier commits the push also carries', async () => {
    const preview = {
      publicationId: 'pub-earlier',
      repo: 'harborline/payments-api',
      prNumber: 318,
      branch: 'hl/fix-duplicate-credit',
      localHead: 'c81e5aaaaaa',
      remoteHead: '7d02b11bbbb',
      requiresPush: true,
      frozenAt: 1,
      commits: [],
      unapproved: [],
      earlierCommits: [
        {
          sha: '3b7d10eaaaa',
          shortSha: '3b7d10e',
          subject: 'Rename the delivery row helper',
          author: 'resolver',
          timestamp: 1,
          pushed: false,
          parentSha: null,
        },
        {
          sha: '91fa2c4aaaa',
          shortSha: '91fa2c4',
          subject: 'Log the redelivery count',
          author: 'resolver',
          timestamp: 1,
          pushed: false,
          parentSha: null,
        },
      ],
      replies: [{ threadId: EXPANDED_THREAD_ID, body: 'Fixed.', revision: 1, closes: true }],
      notes: [],
      excluded: [],
      drift: [],
      blocker: null,
    };
    stub({
      preparePublication: async () => preview,
    });
    await mount({ agentId: SINGLE });
    const items = useAppStore.getState().sessionResolveQueueItems[SESSION.id] ?? [];
    useAppStore.setState({
      sessionResolveQueueItems: {
        [SESSION.id]: items.map((entry) =>
          entry.thread.threadId === EXPANDED_THREAD_ID
            ? {
                item: { ...entry.item, approvalState: 'accepted', approvedRevision: 1 },
                thread: { ...entry.thread, stage: 'approved', commitShas: ['c81e5aaaaaa'] },
              }
            : entry,
        ),
      },
    });
    await settle();

    fireEvent.click(await screen.findByRole('button', { name: /Push now/ }));
    const confirm = await screen.findByRole('group', {
      name: 'Push 1 to hl/fix-duplicate-credit?',
    });

    expect(within(confirm).getByText('This also pushes 2 earlier commits')).toBeDefined();
    expect(within(confirm).getByText('3b7d10e')).toBeDefined();
    expect(within(confirm).getByText('Log the redelivery count')).toBeDefined();
  });

  it('gives a batch child the same sections and only Open in Review', async () => {
    await mount({ agentId: CHILD });

    const article = screen.getByRole('article', { name: 'Comment' });
    expect(within(article).getByRole('heading', { name: 'Comment' })).toBeDefined();
    expect(
      within(article)
        .queryAllByRole('button')
        .filter((button) => button.hasAttribute('data-review-verb')),
    ).toEqual([]);
    expect(screen.queryByRole('button', { name: /^Accept/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Push now/ })).toBeNull();
    expect(
      screen.getByText(
        'This comment was fixed with 1 other. Accept and push them together in Review.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open in Review (2)' })).toBeDefined();
  });

  it('opens Review on the whole batch with the child first', async () => {
    const openReviewTarget = vi.fn<StoreState['openReviewTarget']>(async () => ({
      kind: 'opened' as const,
    }));
    stub({ openReviewTarget });
    await mount({ agentId: CHILD });

    fireEvent.click(screen.getByRole('button', { name: 'Open in Review (2)' }));

    await waitFor(() => expect(openReviewTarget).toHaveBeenCalledOnce());
    expect(openReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      destination: { kind: 'threads', mountId: CHILD_MOUNT, threadIds: [TYPO, CONSTANT] },
    });
  });
});
