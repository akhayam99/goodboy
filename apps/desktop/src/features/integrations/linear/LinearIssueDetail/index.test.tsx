// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
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
    expect(screen.getByText('Assigned to Grace Hopper')).toBeDefined();
    expect(screen.getByText('Full')).toBeDefined();
    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('The fix is ready for review.')).toBeDefined();
  });
});
