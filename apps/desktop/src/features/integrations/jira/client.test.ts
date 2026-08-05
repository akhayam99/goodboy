import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';
import {
  jiraCreateComment,
  jiraDisconnect,
  jiraGetIssue,
  jiraListAssignableUsers,
  jiraListComments,
  jiraListIssues,
  jiraListTransitions,
  jiraSetAssignee,
  jiraTransitionIssue,
  jiraUpdateIssueDescription,
  jiraValidateConnection,
  type JiraIssue,
} from './client';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const mockInvoke = vi.mocked(invoke);

afterEach(() => {
  mockInvoke.mockReset();
});

const site = {
  workspaceId: 'w1' as WorkspaceId,
  siteUrl: 'https://acme.atlassian.net',
  email: 'amin@acme.io',
};

const target = { ...site, issueKey: 'GB-12' };

describe('jira client', () => {
  it('validates a connection with the site, email and api token', async () => {
    mockInvoke.mockResolvedValue({ accountId: 'acc-1', displayName: 'Amin' });

    await jiraValidateConnection({ ...site, apiToken: 'tok' });

    expect(mockInvoke).toHaveBeenCalledWith('jira_validate_connection', {
      workspaceId: 'w1',
      siteUrl: 'https://acme.atlassian.net',
      email: 'amin@acme.io',
      apiToken: 'tok',
    });
  });

  it('disconnects with the workspace alone', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await jiraDisconnect({ workspaceId: 'w1' as WorkspaceId });

    expect(mockInvoke).toHaveBeenCalledWith('jira_disconnect', { workspaceId: 'w1' });
  });

  it('lists issues for a project key and returns the payload untouched', async () => {
    const issue: JiraIssue = {
      id: '10002',
      key: 'GB-12',
      summary: 'Ship the jira lens',
      description: 'Needs ADF',
      status: 'In Progress',
      statusCategory: 'indeterminate',
      issueType: 'Task',
      priority: 'High',
      assignee: null,
      reporter: null,
      labels: ['backend'],
      created: '2026-07-01T10:00:00.000+0000',
      updated: '2026-07-02T10:00:00.000+0000',
      url: 'https://acme.atlassian.net/browse/GB-12',
    };
    mockInvoke.mockResolvedValue([issue]);

    const issues = await jiraListIssues({ ...site, projectKey: 'GB', assignedOnly: true });

    expect(mockInvoke).toHaveBeenCalledWith('jira_list_issues', {
      ...site,
      projectKey: 'GB',
      assignedOnly: true,
    });
    expect(issues).toEqual([issue]);
  });

  it('reads a single issue by key', async () => {
    mockInvoke.mockResolvedValue({ key: 'GB-12' });

    await jiraGetIssue(target);

    expect(mockInvoke).toHaveBeenCalledWith('jira_get_issue', target);
  });

  it('lists and creates comments against the same issue key', async () => {
    mockInvoke.mockResolvedValue([]);
    await jiraListComments(target);
    expect(mockInvoke).toHaveBeenCalledWith('jira_list_comments', target);

    mockInvoke.mockResolvedValue({ id: '1', author: null, body: 'ok', created: '', updated: '' });
    await jiraCreateComment({ ...target, body: 'ship it' });
    expect(mockInvoke).toHaveBeenCalledWith('jira_create_comment', {
      ...target,
      body: 'ship it',
    });
  });

  it('sends the description as plain text and resolves to nothing', async () => {
    mockInvoke.mockResolvedValue(undefined);

    const result = await jiraUpdateIssueDescription({ ...target, description: 'new body' });

    expect(mockInvoke).toHaveBeenCalledWith('jira_update_issue', {
      ...target,
      description: 'new body',
    });
    expect(result).toBeUndefined();
  });

  it('passes a null account id through when unassigning', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await jiraSetAssignee({ ...target, accountId: null });

    expect(mockInvoke).toHaveBeenCalledWith('jira_set_assignee', { ...target, accountId: null });
  });

  it('normalizes a missing assignable-user query to null', async () => {
    mockInvoke.mockResolvedValue([]);

    await jiraListAssignableUsers(target);

    expect(mockInvoke).toHaveBeenCalledWith('jira_list_assignable_users', {
      ...target,
      query: null,
    });
  });

  it('lists transitions and posts the chosen transition id', async () => {
    mockInvoke.mockResolvedValue([{ id: '31', name: 'Done', to: null, hasScreen: false }]);
    const transitions = await jiraListTransitions(target);
    expect(transitions).toHaveLength(1);
    expect(mockInvoke).toHaveBeenCalledWith('jira_list_transitions', target);

    mockInvoke.mockResolvedValue(undefined);
    await jiraTransitionIssue({ ...target, transitionId: '31' });
    expect(mockInvoke).toHaveBeenCalledWith('jira_transition_issue', {
      ...target,
      transitionId: '31',
    });
  });
});
