// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { jiraListComments, type JiraIssue } from '../client';

const h = vi.hoisted(() => ({
  config: {
    siteUrl: 'https://acme.atlassian.net',
    email: 'grace@acme.com',
    projectKey: 'ENG',
  } as unknown,
}));

vi.mock('../useJiraConfig', () => ({ useJiraConfig: () => h.config }));
vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  jiraListComments: vi.fn(async () => []),
}));

import { JiraIssueDetail } from '.';

const listComments = vi.mocked(jiraListComments);

const ISSUE: JiraIssue = {
  id: '10042',
  key: 'ENG-142',
  summary: 'Session rail drops focus',
  description: 'The rail loses focus after a turn ends.',
  status: 'In Progress',
  statusCategory: 'indeterminate',
  issueType: 'Bug',
  priority: 'High',
  assignee: { accountId: 'a1', displayName: 'Grace Hopper' } as JiraIssue['assignee'],
  reporter: null,
  labels: ['rail'],
  created: '2026-07-01T10:00:00.000Z',
  updated: '2026-07-02T10:00:00.000Z',
  url: 'https://acme.atlassian.net/browse/ENG-142',
};

beforeEach(() => {
  listComments.mockClear();
  listComments.mockResolvedValue([]);
});
afterEach(cleanup);

describe('JiraIssueDetail', () => {
  it('leads with the key, the live status and the summary', async () => {
    render(<JiraIssueDetail issue={ISSUE} workspaceId={'workspace-1' as WorkspaceId} />);

    expect(screen.getByText('ENG-142')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('Session rail drops focus')).toBeDefined();
    await waitFor(() => expect(listComments).toHaveBeenCalled());
  });

  it('renders the description read-only, with no edit affordance', async () => {
    render(<JiraIssueDetail issue={ISSUE} workspaceId={'workspace-1' as WorkspaceId} />);

    expect(screen.getByText(/The rail loses focus after a turn ends/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    await waitFor(() => expect(listComments).toHaveBeenCalled());
  });

  it('surfaces the issue type, assignee and labels as properties', async () => {
    render(<JiraIssueDetail issue={ISSUE} workspaceId={'workspace-1' as WorkspaceId} />);

    expect(screen.getByText('Bug')).toBeDefined();
    expect(screen.getByText('Grace Hopper')).toBeDefined();
    expect(screen.getByText('rail')).toBeDefined();
    await waitFor(() => expect(listComments).toHaveBeenCalled());
  });
});
