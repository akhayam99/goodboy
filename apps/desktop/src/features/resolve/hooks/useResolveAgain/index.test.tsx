// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { AgentId, PrComment, PullRequestState, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { useResolveAgain } from './index';

const { startResolve } = vi.hoisted(() => ({
  startResolve: vi.fn(async () => [] as ReadonlyArray<AgentId>),
}));

vi.mock('../../startResolve', () => ({ startResolve }));

const SESSION_ID = 'session-retry' as SessionId;
const PR = { number: 248, headBranch: 'feature/retry' } as unknown as PullRequestState;

const REVIEW_COMMENT = {
  id: 'c1',
  author: 'harbor-reviewer',
  authorAvatarUrl: null,
  body: 'Two deliveries race past the dedupe check.',
  createdAt: '2026-01-05T09:00:00.000Z',
  url: 'https://github.com/acme/notify-relay/pull/248#discussion_1',
  source: 'review',
  resolved: false,
  path: 'src/idempotency.ts',
  line: 55,
  threadId: 'PRRT_1',
} as unknown as PrComment;

const ROW = {
  thread: { threadId: 'PRRT_1', replyDraft: 'Tried a lock', commitShas: ['aa11bb22'] },
  commentThread: null,
} as unknown as ResolveQueueRow;

const PICKED = { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' } as const;

beforeEach(() => {
  startResolve.mockClear();
  useAppStore.setState({
    sessions: [],
    projects: [],
    workspaceOverrides: {},
    sessionActiveProject: {},
    sessionGithub: {
      [SESSION_ID]: { pr: PR, detail: { comments: [REVIEW_COMMENT] } },
    } as unknown as ReturnType<typeof useAppStore.getState>['sessionGithub'],
    resolveQueueView: {
      [SESSION_ID]: { lastRouting: PICKED },
    } as unknown as ReturnType<typeof useAppStore.getState>['resolveQueueView'],
  });
});

afterEach(() => {
  cleanup();
});

describe('useResolveAgain', () => {
  it('retries on the model picked for the session with the settings commit style', async () => {
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    let outcome = '';
    await act(async () => {
      outcome = await result.current({ threadId: 'PRRT_1', instruction: 'Use ON CONFLICT' });
    });

    expect(outcome).toBe('started');
    const call = startResolve.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(call[0]).toMatchObject({
      routing: PICKED,
      note: 'Use ON CONFLICT',
      mode: 'retry',
      style: { commitStyle: 'new' },
      priorContext: [{ threadId: 'PRRT_1', reply: 'Tried a lock', intent: 'retry' }],
    });
  });

  it('reports a thread that left the pull request as missing', async () => {
    const { result } = renderHook(() => useResolveAgain({ sessionId: SESSION_ID, rows: [ROW] }));

    let outcome = '';
    await act(async () => {
      outcome = await result.current({ threadId: 'PRRT_gone', instruction: '' });
    });

    expect(outcome).toBe('missing');
    expect(startResolve).not.toHaveBeenCalled();
  });
});
