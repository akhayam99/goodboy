// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const { acceptResolveQueueItem, publishResolveThread } = vi.hoisted(() => ({
  acceptResolveQueueItem: vi.fn(),
  publishResolveThread: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', async () => {
  const { create } = await import('zustand');
  const useAppStore = create((set) => {
    const write = set as unknown as (
      updater: (s: Record<string, unknown>) => Record<string, unknown>,
    ) => void;
    return {
      sessionResolveCandidates: {},
      sessionResolveCheckRuns: {},
      sessionResolveQueueItems: {},
      discoveredScripts: {},
      resolveItemDrafts: {},
      acceptResolveQueueItem,
      publishResolveThread,
      discussResolveThread: vi.fn(async () => undefined),
      takeUpResolveQueueItem: vi.fn(async () => undefined),
      openResolveAgent: vi.fn(),
      refuseResolveQueueItem: vi.fn(),
      deferResolveQueueItem: vi.fn(),
      reopenResolveQueueItem: vi.fn(),
      runResolveCheck: vi.fn(),
      forceCloseResolver: vi.fn(),
      selectAgent: vi.fn(),
      loadDiscoveredScripts: vi.fn(async () => undefined),
      setResolveItemDraft: ({
        sessionId,
        threadId,
        patch,
      }: {
        readonly sessionId: string;
        readonly threadId: string;
        readonly patch: Record<string, unknown>;
      }) =>
        write((s) => {
          const drafts = s.resolveItemDrafts as Record<
            string,
            Record<string, Record<string, unknown>>
          >;
          const forSession = drafts[sessionId] ?? {};
          const current = forSession[threadId] ?? { reply: null, instruction: '', mode: 'reply' };
          return {
            resolveItemDrafts: {
              ...drafts,
              [sessionId]: { ...forSession, [threadId]: { ...current, ...patch } },
            },
          };
        }),
    };
  });
  return { useAppStore, EMPTY_ARRAY: [] };
});

vi.mock('../../../session/hooks/useAgentMetrics', () => ({
  useAgentMetrics: () => ({
    latestTelemetryByAgentId: new Map(),
    aggregatesByAgentId: new Map(),
    providerUsageByAgentId: new Map(),
    turnsByAgentId: new Map(),
  }),
}));

vi.mock('../../hooks/useResolveCandidateDiff', () => ({
  useResolveCandidateDiff: () => ({ files: [], isLoading: false, error: null }),
}));

import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { ResolveItemContainer } from './ResolveItemContainer';

const sessionId = 'session-1' as SessionId;

const rowOf = ({ threadId, body }: { readonly threadId: string; readonly body: string }) =>
  ({
    item: { id: `item-${threadId}`, approvalState: 'none', integratedSha: null },
    thread: { threadId, revision: 1, stateReason: null, commitShas: null, question: null },
    commentThread: {
      head: {
        id: `comment-${threadId}`,
        author: 'dhh',
        authorAvatarUrl: null,
        body,
        createdAt: '2026-01-05T09:00:00.000Z',
        url: `https://github.com/example/repo/pull/12#discussion_r${threadId}`,
        source: 'review',
        resolved: false,
        path: 'src/retry.ts',
        line: 84,
        threadId,
      },
      replies: [],
    },
    status: 'fix_ready',
    attempt: null,
    reviewerNote: {
      body,
      author: 'dhh',
      createdAtMs: 1,
      location: 'src/retry.ts:84',
      path: 'src/retry.ts',
      line: 84,
    },
    proposal: 'Added the early return.',
    proposalKind: 'fix',
    coveredThreadIds: [],
    delivery: null,
  }) as unknown as ResolveQueueRow;

const RETRY = rowOf({ threadId: 't-retry', body: 'This retries forever on a 500.' });
const PARSER = rowOf({ threadId: 't-parser', body: 'The parser swallows the error here.' });

type RenderParams = {
  readonly row: ResolveQueueRow;
  readonly nextThreadId?: string | null;
  readonly onSelect?: (threadId: string | null) => void;
};

const renderContainer = ({ row, nextThreadId = null, onSelect = vi.fn() }: RenderParams) =>
  render(
    <ResolveItemContainer
      sessionId={sessionId}
      row={row}
      allRows={[RETRY, PARSER]}
      nextThreadId={nextThreadId}
      worktreePath={null}
      onSelect={onSelect}
      onAskForChanges={vi.fn()}
      onOpenInDiff={vi.fn()}
    />,
  );

const confirmResolve = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /^Resolve/ }));
  fireEvent.click(screen.getAllByRole('button', { name: /^Resolve/ }).at(-1) as HTMLElement);
};

beforeEach(() => {
  acceptResolveQueueItem.mockReset();
  publishResolveThread.mockReset();
  publishResolveThread.mockImplementation(async () => undefined);
});

afterEach(cleanup);

describe('an asynchronous resolve decision', () => {
  it('carries a rewritten reply into the publication of a comment already settled', async () => {
    const settled = {
      ...RETRY,
      status: 'ready_to_push',
      item: { ...RETRY.item, approvalState: 'accepted' },
      thread: { ...RETRY.thread, replyDraft: 'The reply the agent wrote.' },
    } as unknown as ResolveQueueRow;
    acceptResolveQueueItem.mockImplementation(async () => undefined);
    renderContainer({ row: settled });
    fireEvent.click(screen.getByRole('button', { name: 'Edit reply' }));
    fireEvent.change(screen.getByLabelText('Reply to reviewer'), {
      target: { value: 'The reply I wrote myself.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save reply' }));
    confirmResolve();

    await vi.waitFor(() => expect(publishResolveThread).toHaveBeenCalledOnce());
    expect(acceptResolveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({ reply: 'The reply I wrote myself.' }),
    );
  });

  it('leaves a settled comment alone when its reply was not touched', async () => {
    const settled = {
      ...PARSER,
      status: 'ready_to_push',
      item: { ...PARSER.item, approvalState: 'accepted' },
      thread: { ...PARSER.thread, replyDraft: 'Added the early return.' },
    } as unknown as ResolveQueueRow;
    renderContainer({ row: settled });
    confirmResolve();

    await vi.waitFor(() => expect(publishResolveThread).toHaveBeenCalledOnce());
    expect(acceptResolveQueueItem).not.toHaveBeenCalled();
  });

  it('reports its failure onto the comment it was started from', async () => {
    let fail: (error: Error) => void = () => undefined;
    acceptResolveQueueItem.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    renderContainer({ row: RETRY });

    confirmResolve();
    fail(new Error('The branch moved under the approval'));
    await vi.waitFor(() =>
      expect(screen.getByText('The branch moved under the approval')).toBeDefined(),
    );
  });

  it('never reports onto the comment the maintainer moved on to', async () => {
    let fail: (error: Error) => void = () => undefined;
    acceptResolveQueueItem.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const view = renderContainer({ row: RETRY });

    confirmResolve();
    view.rerender(
      <ResolveItemContainer
        sessionId={sessionId}
        row={PARSER}
        allRows={[RETRY, PARSER]}
        nextThreadId={null}
        worktreePath={null}
        onSelect={vi.fn()}
        onAskForChanges={vi.fn()}
        onOpenInDiff={vi.fn()}
      />,
    );
    fail(new Error('The branch moved under the approval'));
    await Promise.resolve();

    expect(screen.getByText('The parser swallows the error here.')).toBeDefined();
    expect(screen.queryByText('The branch moved under the approval')).toBeNull();
  });

  it('moves to the comment below once the approval has landed', async () => {
    acceptResolveQueueItem.mockResolvedValue(undefined);
    const onSelect = vi.fn();
    renderContainer({ row: RETRY, nextThreadId: 't-parser', onSelect });

    confirmResolve();

    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith('t-parser'));
  });

  it('leaves the panel shut when the approved comment was the last one', async () => {
    acceptResolveQueueItem.mockResolvedValue(undefined);
    const onSelect = vi.fn();
    renderContainer({ row: RETRY, nextThreadId: null, onSelect });

    confirmResolve();

    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(null));
  });

  it('never moves the panel on when the maintainer opened another comment meanwhile', async () => {
    let land: () => void = () => undefined;
    acceptResolveQueueItem.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          land = resolve;
        }),
    );
    const onSelect = vi.fn();
    const view = renderContainer({ row: RETRY, nextThreadId: 't-parser', onSelect });

    confirmResolve();
    view.rerender(
      <ResolveItemContainer
        sessionId={sessionId}
        row={PARSER}
        allRows={[RETRY, PARSER]}
        nextThreadId={null}
        worktreePath={null}
        onSelect={onSelect}
        onAskForChanges={vi.fn()}
        onOpenInDiff={vi.fn()}
      />,
    );
    land();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText('The parser swallows the error here.')).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('never moves the panel on once the comment it decided has been closed', async () => {
    let land: () => void = () => undefined;
    acceptResolveQueueItem.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          land = resolve;
        }),
    );
    const onSelect = vi.fn();
    const view = renderContainer({ row: RETRY, nextThreadId: 't-parser', onSelect });

    confirmResolve();
    view.unmount();
    land();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('never moves on when the approval failed', async () => {
    acceptResolveQueueItem.mockRejectedValue(new Error('The branch moved under the approval'));
    const onSelect = vi.fn();
    renderContainer({ row: RETRY, nextThreadId: 't-parser', onSelect });

    confirmResolve();

    await vi.waitFor(() =>
      expect(screen.getByText('The branch moved under the approval')).toBeDefined(),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });
});
