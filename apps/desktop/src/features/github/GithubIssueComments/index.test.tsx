import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GithubIssueComment } from '@goodboy/types';
import { GithubIssueComments } from './index';

const COMMENT: GithubIssueComment = {
  id: '1',
  author: 'ada',
  authorAvatarUrl: null,
  body: 'Blocked on the migration.',
  createdAt: '2026-07-23T10:00:00Z',
  url: 'https://github.com/acme/web/issues/42#issuecomment-1',
};

afterEach(cleanup);

describe('GithubIssueComments', () => {
  it('shows a loading placeholder while the thread is fetched', () => {
    render(<GithubIssueComments comments={[]} isLoading error={null} onPost={null} />);

    expect(screen.getByRole('status', { name: 'Loading comments' })).toBeDefined();
  });

  it('surfaces a fetch failure', () => {
    render(
      <GithubIssueComments comments={[]} isLoading={false} error="gh api exited 1" onPost={null} />,
    );

    expect(screen.getByText('gh api exited 1')).toBeDefined();
  });

  it('tells the user the issue has no comments yet', () => {
    render(<GithubIssueComments comments={[]} isLoading={false} error={null} onPost={null} />);

    expect(screen.getByText('No comments')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Write a comment' })).toBeNull();
  });

  it('renders the author and body of every comment', () => {
    render(
      <GithubIssueComments
        comments={[COMMENT, { ...COMMENT, id: '2', author: 'linus', body: 'Merged.' }]}
        isLoading={false}
        error={null}
        onPost={null}
      />,
    );

    expect(screen.getByText('ada')).toBeDefined();
    expect(screen.getByText('Blocked on the migration.')).toBeDefined();
    expect(screen.getByText('Merged.')).toBeDefined();
  });

  it('renders a real avatar src and accessible name for the comment author', () => {
    const comment: GithubIssueComment = {
      ...COMMENT,
      authorAvatarUrl: 'https://github.example/avatars/ada.png',
    };
    render(
      <GithubIssueComments comments={[comment]} isLoading={false} error={null} onPost={null} />,
    );

    const avatar = screen.getByRole('img', { name: 'ada' });
    expect(avatar.getAttribute('src')).toBe('https://github.example/avatars/ada.png');
  });

  it('falls back to the author initial when there is no avatar url', () => {
    render(
      <GithubIssueComments comments={[COMMENT]} isLoading={false} error={null} onPost={null} />,
    );

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('A')).toBeDefined();
  });

  it('renders a relative timestamp for each comment', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T10:00:00Z'));

    render(
      <GithubIssueComments comments={[COMMENT]} isLoading={false} error={null} onPost={null} />,
    );

    expect(screen.getByText('3d ago')).toBeDefined();

    vi.useRealTimers();
  });

  it('posts the draft and clears the composer', async () => {
    const onPost = vi.fn(async () => {});
    render(
      <GithubIssueComments comments={[COMMENT]} isLoading={false} error={null} onPost={onPost} />,
    );

    const box = screen.getByRole('textbox', { name: 'Write a comment' });
    fireEvent.change(box, { target: { value: 'On it.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(onPost).toHaveBeenCalledWith('On it.'));
    await waitFor(() => expect((box as HTMLTextAreaElement).value).toBe(''));
  });

  it('keeps the draft and shows why when posting fails', async () => {
    const onPost = vi.fn(async () => {
      throw new Error('gh api exited 1');
    });
    render(
      <GithubIssueComments comments={[COMMENT]} isLoading={false} error={null} onPost={onPost} />,
    );

    const box = screen.getByRole('textbox', { name: 'Write a comment' });
    fireEvent.change(box, { target: { value: 'On it.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('gh api exited 1'));
    expect((box as HTMLTextAreaElement).value).toBe('On it.');
  });
});
