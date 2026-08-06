// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { linearUpdateIssueDescription, type LinearIssue } from '../client';

vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  linearUpdateIssueDescription: vi.fn(),
}));

const postComment = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('../useLinearIssueComments', () => ({
  useLinearIssueComments: () => ({
    comments: [
      {
        id: 'comment-1',
        body: 'The fix is ready for review.',
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        user: { name: 'Ada Lovelace' },
      },
    ],
    isLoading: false,
    error: null,
    post: postComment,
  }),
}));

import { LinearIssueDetail } from '.';

const ISSUE: LinearIssue = {
  id: 'issue-1',
  identifier: 'GB-42',
  title: 'Improve linked issue detail',
  description: '**Full** description',
  url: 'https://linear.app/goodboy/issue/GB-42',
  state: { name: 'In Progress', type: 'started' },
  team: { key: 'GB' },
  priority: 1,
  priorityLabel: 'Urgent',
  assignee: { name: 'Grace Hopper' },
  project: { name: 'Desktop' },
  labels: { nodes: [{ name: 'UI', color: '#5e6ad2' }] },
  updatedAt: '2026-07-23T10:00:00Z',
};

const updateDescription = vi.mocked(linearUpdateIssueDescription);

beforeEach(() => {
  updateDescription.mockReset();
  postComment.mockClear();
});

afterEach(cleanup);

describe('LinearIssueDetail', () => {
  it('renders issue metadata, markdown, and comments', () => {
    render(<LinearIssueDetail issue={ISSUE} workspaceId={'workspace-1' as WorkspaceId} />);

    expect(screen.getByText('Urgent')).toBeDefined();
    expect(screen.queryByLabelText('Priority: Urgent')).toBeNull();
    expect(screen.getByText('Grace Hopper')).toBeDefined();
    expect(screen.getByText('GB')).toBeDefined();
    expect(screen.getByText('Desktop')).toBeDefined();
    expect(screen.getByText('Full')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: /Conversation/ }));

    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('The fix is ready for review.')).toBeDefined();
  });

  it('sends a comment written in the conversation tab back to Linear', async () => {
    render(<LinearIssueDetail issue={ISSUE} workspaceId={'workspace-1' as WorkspaceId} />);

    fireEvent.click(screen.getByRole('tab', { name: /Conversation/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Write a comment' }), {
      target: { value: 'Merging this' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(postComment).toHaveBeenCalledWith('Merging this'));
  });

  it('keeps a fenced description as a code block', () => {
    const { container } = render(
      <LinearIssueDetail
        issue={{ ...ISSUE, description: '```\nnot markdown, a fence\n```' }}
        workspaceId={'workspace-1' as WorkspaceId}
      />,
    );

    expect(container.querySelector('pre code')?.textContent).toBe('not markdown, a fence');
  });

  it('saves an edited description and renders the body Linear returned', async () => {
    updateDescription.mockResolvedValueOnce('Body normalized by Linear');
    render(<LinearIssueDetail issue={ISSUE} workspaceId={'workspace-1' as WorkspaceId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit description' }), {
      target: { value: 'Body typed by the user' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateDescription).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        issueId: 'issue-1',
        description: 'Body typed by the user',
      }),
    );
    await waitFor(() => expect(screen.getByText('Body normalized by Linear')).toBeDefined());
    expect(screen.queryByText('Body typed by the user')).toBeNull();
  });

  it('keeps the draft and shows the error inline when Linear rejects the save', async () => {
    updateDescription.mockRejectedValueOnce(new Error('linear_update_issue: graphql error'));
    render(<LinearIssueDetail issue={ISSUE} workspaceId={'workspace-1' as WorkspaceId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit description' }), {
      target: { value: 'Body that fails' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('linear_update_issue: graphql error'),
    );
    expect(
      (screen.getByRole('textbox', { name: 'Edit description' }) as HTMLTextAreaElement).value,
    ).toBe('Body that fails');
  });

  it('renders the properties in registry order, once', () => {
    render(<LinearIssueDetail issue={ISSUE} workspaceId={'workspace-1' as WorkspaceId} />);

    const panels = screen.getAllByTestId('detail-properties');
    expect(panels).toHaveLength(1);
    expect(
      within(panels[0] as HTMLElement)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Priority', 'Assignee', 'Team', 'Project', 'Labels', 'Updated']);
  });
});
