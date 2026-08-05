import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { JiraComment } from '../client';
import { IssueConversation } from './index';

const COMMENT: JiraComment = {
  id: '1',
  body: 'Pipeline is green.',
  created: '2026-08-01T10:00:00Z',
  updated: '2026-08-01T10:00:00Z',
  author: {
    accountId: 'acc-1',
    displayName: 'Ada Lovelace',
    emailAddress: null,
    active: true,
    avatarUrls: {
      '24x24': 'https://jira.example/avatars/ada-24.png',
      '48x48': 'https://jira.example/avatars/ada-48.png',
    },
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-04T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('IssueConversation (jira)', () => {
  it('renders a real avatar src and accessible name for the comment author', () => {
    render(
      <IssueConversation
        comments={[COMMENT]}
        isLoading={false}
        error={null}
        onRetry={() => {}}
        onPost={null}
      />,
    );

    const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(avatar.getAttribute('src')).toBe('https://jira.example/avatars/ada-24.png');
  });

  it('falls back to the author initial when there is no avatar url', () => {
    const comment: JiraComment = {
      ...COMMENT,
      author: { ...COMMENT.author, displayName: 'Bo', avatarUrls: null },
    };
    render(
      <IssueConversation
        comments={[comment]}
        isLoading={false}
        error={null}
        onRetry={() => {}}
        onPost={null}
      />,
    );

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('B')).toBeDefined();
  });

  it('renders the author name and a relative timestamp for each comment', () => {
    render(
      <IssueConversation
        comments={[COMMENT]}
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
