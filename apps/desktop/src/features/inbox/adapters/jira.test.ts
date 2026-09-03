import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { JiraIssue } from '../../integrations/jira/client';
import type { JiraIssueGroup } from '../../integrations/jira/JiraStudio/useJiraIssues';
import { adaptJiraIssues } from './jira';

const issue = (overrides: Partial<JiraIssue> = {}): JiraIssue => ({
  id: 'issue-1',
  key: 'GBY-9',
  summary: 'Add the shared inbox',
  description: '',
  status: 'In Progress',
  statusCategory: 'indeterminate',
  issueType: 'Task',
  priority: null,
  assignee: null,
  reporter: null,
  labels: [],
  created: '2026-07-01T10:00:00Z',
  updated: '2026-08-01T10:00:00Z',
  url: 'https://goodboy.atlassian.net/browse/GBY-9',
  ...overrides,
});

describe('adaptJiraIssues', () => {
  it('maps an issue row into a normalized inbox record', () => {
    const sessionId = 'session-1' as SessionId;
    const groups: ReadonlyArray<JiraIssueGroup> = [
      { key: 'indeterminate', label: 'In progress', rows: [{ issue: issue(), sessionId }] },
    ];

    const [record] = adaptJiraIssues({ groups });

    expect(record).toEqual({
      key: 'jira:issue:issue-1',
      provider: 'jira',
      kind: 'issue',
      identifier: 'GBY-9',
      title: 'Add the shared inbox',
      state: 'active',
      updatedAt: '2026-08-01T10:00:00Z',
      url: 'https://goodboy.atlassian.net/browse/GBY-9',
      meta: 'Task · In Progress',
      payload: { provider: 'jira', kind: 'issue', issue: issue(), sessionId },
    });
  });

  it.each([
    ['done', 'done'],
    ['indeterminate', 'active'],
    ['new', 'open'],
    ['', 'open'],
  ] as const)('normalizes status category %s to %s', (statusCategory, expected) => {
    const groups: ReadonlyArray<JiraIssueGroup> = [
      {
        key: statusCategory,
        label: 'g',
        rows: [{ issue: issue({ statusCategory }), sessionId: null }],
      },
    ];

    const [record] = adaptJiraIssues({ groups });

    expect(record?.state).toBe(expected);
  });
});
