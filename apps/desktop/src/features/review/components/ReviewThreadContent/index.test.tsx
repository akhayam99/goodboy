// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrComment } from '@goodboy/types';
import type { CommentThread } from '../../../github/comment-threads';
import { ReviewThreadContent } from './index';

const HEAD_URL = 'https://github.com/acme/web/pull/248#discussion_r1';

const commentOf = (patch: Partial<PrComment> = {}): PrComment => ({
  id: 'comment-1',
  author: 'dhh',
  authorAvatarUrl: 'https://avatars.example/dhh.png',
  body: 'This retries forever on a 500.',
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  url: HEAD_URL,
  source: 'review',
  resolved: false,
  path: 'src/retry.ts',
  line: 84,
  threadId: 'PRRT_1',
  ...patch,
});

const threadOf = (patch: Partial<PrComment> = {}): CommentThread => ({
  head: commentOf(patch),
  replies: [
    commentOf({
      id: 'comment-2',
      author: 'jane',
      body: 'Agreed, the backoff never kicks in.',
    }),
  ],
});

afterEach(cleanup);

describe('the review thread content', () => {
  it('keeps the author, the avatar, the age, the location and the body of the head comment', () => {
    render(<ReviewThreadContent thread={threadOf()} onOpenUrl={vi.fn()} />);

    expect(screen.getByText('dhh')).toBeDefined();
    expect(screen.getByRole('img', { name: 'dhh' }).getAttribute('src')).toBe(
      'https://avatars.example/dhh.png',
    );
    expect(screen.getAllByText('3h ago').length).toBeGreaterThan(0);
    expect(screen.getByText('src/retry.ts:84')).toBeDefined();
    expect(screen.getByText('This retries forever on a 500.')).toBeDefined();
  });

  it('keeps the replies of the conversation, not only its head', () => {
    render(<ReviewThreadContent thread={threadOf()} onOpenUrl={vi.fn()} />);

    expect(screen.getByText('Agreed, the backoff never kicks in.')).toBeDefined();
    expect(screen.getByText('jane')).toBeDefined();
  });

  it('names an open thread and a resolved one apart', () => {
    const { unmount } = render(<ReviewThreadContent thread={threadOf()} onOpenUrl={vi.fn()} />);
    expect(screen.getByText('Open')).toBeDefined();
    unmount();

    render(<ReviewThreadContent thread={threadOf({ resolved: true })} onOpenUrl={vi.fn()} />);
    expect(screen.getByText('Resolved')).toBeDefined();
  });

  it('marks a comment anchored to code later commits changed', () => {
    render(<ReviewThreadContent thread={threadOf({ outdated: true })} onOpenUrl={vi.fn()} />);

    expect(screen.getByText('Outdated')).toBeDefined();
  });

  it('opens the comment on github from its own url', () => {
    const onOpenUrl = vi.fn();
    render(<ReviewThreadContent thread={threadOf()} onOpenUrl={onOpenUrl} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open in browser' }));

    expect(onOpenUrl).toHaveBeenCalledWith(HEAD_URL);
  });
});
