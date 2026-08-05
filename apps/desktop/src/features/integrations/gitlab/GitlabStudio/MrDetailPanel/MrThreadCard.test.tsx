import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GitlabMrNote } from '../../client';
import { MrThreadCard } from './MrThreadCard';
import type { MrThread } from './mrThreads';

const HEAD_NOTE: GitlabMrNote = {
  id: 1,
  body: 'Looks good, one nit.',
  system: false,
  author: {
    username: 'ada',
    name: 'Ada Lovelace',
    avatarUrl: 'https://gitlab.example/avatars/ada.png',
  },
  createdAt: '2026-08-01T10:00:00Z',
  resolvable: true,
  resolved: false,
  position: null,
};

const REPLY_NOTE: GitlabMrNote = {
  id: 2,
  body: 'Fixed.',
  system: false,
  author: { username: 'bo', name: 'Bo', avatarUrl: null },
  createdAt: '2026-08-02T10:00:00Z',
  resolvable: true,
  resolved: false,
  position: null,
};

const THREAD: MrThread = {
  id: 'discussion-1',
  head: HEAD_NOTE,
  replies: [REPLY_NOTE],
  filePath: null,
  isResolved: false,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-04T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('MrThreadCard', () => {
  it('renders a real avatar src and accessible name for the thread head note', () => {
    render(<MrThreadCard thread={THREAD} onReply={null} />);

    const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(avatar.getAttribute('src')).toBe('https://gitlab.example/avatars/ada.png');
  });

  it('falls back to the author initial for a reply note with no avatar url', () => {
    render(<MrThreadCard thread={THREAD} onReply={null} />);

    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('renders the resolved pill only when the thread is resolved', () => {
    const { rerender } = render(<MrThreadCard thread={THREAD} onReply={null} />);
    expect(screen.queryByText('resolved')).toBeNull();

    rerender(<MrThreadCard thread={{ ...THREAD, isResolved: true }} onReply={null} />);
    expect(screen.getByText('resolved')).toBeDefined();
  });

  it('renders author name and relative timestamp for the head and reply notes', () => {
    render(<MrThreadCard thread={THREAD} onReply={null} />);

    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('3d ago')).toBeDefined();
    expect(screen.getByText('Bo')).toBeDefined();
    expect(screen.getByText('2d ago')).toBeDefined();
  });
});
