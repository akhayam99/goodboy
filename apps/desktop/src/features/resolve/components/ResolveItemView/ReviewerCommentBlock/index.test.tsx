// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { CommentThread } from '../../../../github/comment-threads';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../../resolveQueueCopy';
import { ReviewerCommentBlock } from './index';

const THREAD: CommentThread = {
  head: {
    id: 'comment-1',
    author: 'dhh',
    authorAvatarUrl: null,
    body: 'This retries forever on a 500.',
    createdAt: '2026-01-05T09:00:00.000Z',
    url: 'https://github.com/acme/web/pull/248#discussion_r1',
    source: 'review',
    resolved: false,
    path: 'src/retry.ts',
    line: 84,
    threadId: 'PRRT_1',
  },
  replies: [
    {
      id: 'comment-2',
      author: 'jane',
      authorAvatarUrl: null,
      body: 'The backoff never kicks in.',
      createdAt: '2026-01-05T10:00:00.000Z',
      url: 'https://github.com/acme/web/pull/248#discussion_r2',
      source: 'review',
    },
  ],
};

afterEach(cleanup);

describe('the reviewer comment block', () => {
  it('shows the remote conversation whole, head and replies', () => {
    render(<ReviewerCommentBlock commentThread={THREAD} onOpenUrl={vi.fn()} />);

    expect(screen.getByText('This retries forever on a 500.')).toBeDefined();
    expect(screen.getByText('The backoff never kicks in.')).toBeDefined();
    expect(screen.getByText('src/retry.ts:84')).toBeDefined();
    expect(screen.getByText('dhh')).toBeDefined();
  });

  it('says the comment is gone instead of rendering an empty block', () => {
    render(<ReviewerCommentBlock commentThread={null} onOpenUrl={vi.fn()} />);

    expect(screen.getByText(RESOLVE_COMMENT_UNAVAILABLE)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open in browser' })).toBeNull();
  });
});
