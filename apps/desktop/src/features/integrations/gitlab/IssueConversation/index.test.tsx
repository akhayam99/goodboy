import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GitlabIssueNote } from '../client';
import { IssueConversation } from './index';

const NOTE: GitlabIssueNote = {
  id: 1,
  body: 'Pipeline is green.',
  system: false,
  author: {
    username: 'ada',
    name: 'Ada Lovelace',
    avatarUrl: 'https://gitlab.example/avatars/ada.png',
  },
  createdAt: '2026-08-01T10:00:00Z',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-04T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('IssueConversation (gitlab)', () => {
  it('renders a real avatar src and accessible name for the note author', () => {
    render(
      <IssueConversation
        notes={[NOTE]}
        isLoading={false}
        error={null}
        onRetry={() => {}}
        onPost={null}
      />,
    );

    const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(avatar.getAttribute('src')).toBe('https://gitlab.example/avatars/ada.png');
  });

  it('falls back to the author initial when there is no avatar url', () => {
    const note: GitlabIssueNote = {
      ...NOTE,
      author: { username: 'bo', name: 'Bo', avatarUrl: null },
    };
    render(
      <IssueConversation
        notes={[note]}
        isLoading={false}
        error={null}
        onRetry={() => {}}
        onPost={null}
      />,
    );

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('B')).toBeDefined();
  });

  it('renders the author name and a relative timestamp for each note', () => {
    render(
      <IssueConversation
        notes={[NOTE]}
        isLoading={false}
        error={null}
        onRetry={() => {}}
        onPost={null}
      />,
    );

    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('3d ago')).toBeDefined();
    expect(screen.getByText('Pipeline is green.')).toBeDefined();
  });
});
