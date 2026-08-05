import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrComment, SessionId } from '@goodboy/types';
import type { ResolverKickoffThread } from '../../utils/parse-resolver-kickoff';

const h = vi.hoisted(() => ({
  comments: [] as ReadonlyArray<PrComment>,
  detail: null as { comments: ReadonlyArray<PrComment> } | null,
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(
    selector: (state: {
      sessionGithub: Record<string, { detail: { comments: ReadonlyArray<PrComment> } | null }>;
    }) => T,
  ) => selector({ sessionGithub: { s: { detail: h.detail } } }),
}));

vi.mock('../../../../shared/lib/editor', () => ({ openUrl: h.openUrl }));

import { ThreadCard } from './ThreadCard';

const SESSION_ID = 's' as SessionId;

const comment = (over: Partial<PrComment> = {}): PrComment => ({
  id: 'review-1',
  author: 'alice',
  authorAvatarUrl: null,
  body: 'this should use a helper',
  createdAt: '2026-05-15T10:00:00Z',
  url: 'https://github.com/o/r/pull/9108#discussion_r1',
  source: 'review',
  path: 'src/foo.ts',
  line: 42,
  resolved: false,
  threadId: 'PRRT_1',
  ...over,
});

const kickoffThread = (over: Partial<ResolverKickoffThread> = {}): ResolverKickoffThread => ({
  position: 1,
  total: 1,
  threadId: 'PRRT_1',
  author: 'alice',
  location: 'src/foo.ts:42',
  link: 'https://github.com/o/r/pull/9108#discussion_r1',
  body: 'this should use a helper',
  replies: [],
  ...over,
});

describe('ThreadCard', () => {
  beforeEach(() => {
    h.comments = [];
    h.detail = null;
    h.openUrl.mockClear();
  });

  afterEach(cleanup);

  it('docks the real thread from the store, collapsed by default', () => {
    h.detail = {
      comments: [
        comment(),
        comment({
          id: 'reply-1',
          author: 'bob',
          body: 'agreed, extracting a helper makes sense',
          inReplyToId: 'review-1',
        }),
      ],
    };

    render(<ThreadCard thread={kickoffThread()} sessionId={SESSION_ID} />);

    expect(screen.getByRole('button', { name: 'Expand thread' })).toBeDefined();
    expect(screen.queryByText('agreed, extracting a helper makes sense')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand thread' }));

    expect(screen.getByRole('button', { name: 'Collapse thread' })).toBeDefined();
    expect(screen.getByText('agreed, extracting a helper makes sense')).toBeDefined();
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
  });

  it('shows the resolved state once docked', () => {
    h.detail = { comments: [comment({ resolved: true })] };

    render(<ThreadCard thread={kickoffThread()} sessionId={SESSION_ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand thread' }));

    expect(screen.getByText('resolved')).toBeDefined();
  });

  it('never renders a reply or resolve affordance for the docked thread', () => {
    h.detail = { comments: [comment()] };

    render(<ThreadCard thread={kickoffThread()} sessionId={SESSION_ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand thread' }));

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /reply/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /resolve/i })).toBeNull();
  });

  it('falls back to the honest external link when no session is attached', () => {
    render(<ThreadCard thread={kickoffThread()} sessionId={null} />);

    expect(screen.queryByRole('button', { name: 'Expand thread' })).toBeNull();
    expect(screen.getByRole('button', { name: /Open on GitHub/ })).toBeDefined();
    expect(screen.getByText('this should use a helper')).toBeDefined();
  });

  it('falls back to the honest external link when the session has no PR detail yet', () => {
    h.detail = null;

    render(<ThreadCard thread={kickoffThread()} sessionId={SESSION_ID} />);

    expect(screen.queryByRole('button', { name: 'Expand thread' })).toBeNull();
    expect(screen.getByRole('button', { name: /Open on GitHub/ })).toBeDefined();
  });

  it('falls back to the honest external link when the thread id is not among the grouped threads', () => {
    h.detail = { comments: [comment({ threadId: 'PRRT_other' })] };

    render(<ThreadCard thread={kickoffThread()} sessionId={SESSION_ID} />);

    expect(screen.queryByRole('button', { name: 'Expand thread' })).toBeNull();
    expect(screen.getByRole('button', { name: /Open on GitHub/ })).toBeDefined();
  });

  it('opens the external link on click', () => {
    render(<ThreadCard thread={kickoffThread()} sessionId={null} />);

    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/ }));

    expect(h.openUrl).toHaveBeenCalledWith('https://github.com/o/r/pull/9108#discussion_r1');
  });
});
