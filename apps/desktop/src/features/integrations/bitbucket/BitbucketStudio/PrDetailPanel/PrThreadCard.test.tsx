import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { BitbucketComment } from '../../client';
import { PrThreadCard } from './PrThreadCard';
import type { BitbucketPrThread } from './bitbucketPrThreads';

const HEAD_COMMENT: BitbucketComment = {
  id: 1,
  body: 'Looks close, one nit.',
  user: {
    uuid: 'u1',
    accountId: 'acc-1',
    nickname: 'ada',
    displayName: 'Ada Lovelace',
    avatarUrl: 'https://bitbucket.example/avatars/ada.png',
  },
  createdOn: '2026-08-01T10:00:00Z',
  updatedOn: '2026-08-01T10:00:00Z',
  deleted: false,
  parentId: null,
  inline: null,
  webUrl: null,
};

const REPLY_COMMENT: BitbucketComment = {
  id: 2,
  body: 'Fixed.',
  user: {
    uuid: 'u2',
    accountId: 'acc-2',
    nickname: 'bo',
    displayName: 'Bo',
    avatarUrl: null,
  },
  createdOn: '2026-08-02T10:00:00Z',
  updatedOn: '2026-08-02T10:00:00Z',
  deleted: false,
  parentId: 1,
  inline: null,
  webUrl: null,
};

const THREAD: BitbucketPrThread = { head: HEAD_COMMENT, replies: [REPLY_COMMENT] };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-04T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('PrThreadCard', () => {
  it('renders a real avatar src and accessible name for the thread head comment', () => {
    render(<PrThreadCard thread={THREAD} onReply={null} />);

    const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(avatar.getAttribute('src')).toBe('https://bitbucket.example/avatars/ada.png');
  });

  it('falls back to the author initial for a reply with no avatar url', () => {
    render(<PrThreadCard thread={THREAD} onReply={null} />);

    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('renders author name and relative timestamp for the head and the reply', () => {
    render(<PrThreadCard thread={THREAD} onReply={null} />);

    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('3d ago')).toBeDefined();
    expect(screen.getByText('Bo')).toBeDefined();
    expect(screen.getByText('2d ago')).toBeDefined();
  });

  it('names the commenter whose bitbucket account is missing', () => {
    render(
      <PrThreadCard
        thread={{ head: { ...HEAD_COMMENT, user: null }, replies: [] }}
        onReply={null}
      />,
    );

    expect(screen.getByText('Unknown')).toBeDefined();
    expect(screen.getByText('U')).toBeDefined();
  });
});
