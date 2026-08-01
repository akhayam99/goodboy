// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { LinearIssue } from '../client';

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

afterEach(cleanup);

describe('LinearIssueDetail', () => {
  it('renders issue metadata, markdown, and comments', () => {
    render(<LinearIssueDetail issue={ISSUE} workspaceId={'workspace-1' as WorkspaceId} />);

    expect(screen.getByLabelText('Priority: Urgent')).toBeDefined();
    expect(screen.getByText('Grace Hopper')).toBeDefined();
    expect(screen.getByText('GB')).toBeDefined();
    expect(screen.getByText('Desktop')).toBeDefined();
    expect(screen.getByText('Full')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: /Conversation/ }));

    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('The fix is ready for review.')).toBeDefined();
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
