import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { LinearIssueComment } from '../client';
import { LinearIssueComments } from './index';

const COMMENT: LinearIssueComment = {
  id: '1',
  body: 'Shipped in v2.',
  createdAt: '2026-08-01T10:00:00Z',
  user: { name: 'Ada Lovelace' },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-04T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const composer = () =>
  screen.queryByRole('textbox', { name: 'Write a comment' }) as HTMLTextAreaElement | null;

describe('LinearIssueComments', () => {
  it('renders no avatar for any comment', () => {
    render(
      <LinearIssueComments comments={[COMMENT]} isLoading={false} error={null} onPost={null} />,
    );

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders the author name and a relative timestamp for each comment', () => {
    render(
      <LinearIssueComments comments={[COMMENT]} isLoading={false} error={null} onPost={null} />,
    );

    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('3d ago')).toBeDefined();
    expect(screen.getByText('Shipped in v2.')).toBeDefined();
  });

  it('keeps the composer out of the way when posting is unavailable', () => {
    render(
      <LinearIssueComments comments={[COMMENT]} isLoading={false} error={null} onPost={null} />,
    );

    expect(composer()).toBeNull();
  });

  it('posts the typed comment and clears the composer', async () => {
    const onPost = vi.fn(async () => {});
    render(
      <LinearIssueComments comments={[COMMENT]} isLoading={false} error={null} onPost={onPost} />,
    );

    fireEvent.change(composer() as HTMLTextAreaElement, { target: { value: '  Looks good  ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    });

    expect(onPost).toHaveBeenCalledWith('Looks good');
    expect(composer()?.value).toBe('');
  });

  it('offers the composer on an issue that has no comments yet', () => {
    render(<LinearIssueComments comments={[]} isLoading={false} error={null} onPost={vi.fn()} />);

    expect(screen.getByText('No comments')).toBeDefined();
    expect(composer()).not.toBeNull();
  });
});
