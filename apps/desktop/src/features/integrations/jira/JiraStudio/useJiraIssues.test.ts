import { describe, expect, it } from 'vitest';
import type { Session, SessionExternalTask, SessionId } from '@goodboy/types';
import type { JiraIssue } from '../client';
import { buildIssueGroups, jiraBranchSlug, resolveIssueSessions } from './useJiraIssues';

const issue = (overrides: Partial<JiraIssue>): JiraIssue =>
  ({
    id: '10042',
    key: 'ENG-142',
    summary: 'Session rail drops focus',
    statusCategory: 'new',
    updated: '2026-07-01T10:00:00.000Z',
    ...overrides,
  }) as JiraIssue;

const session = (id: string): Session => ({ id: id as SessionId }) as Session;

describe('jiraBranchSlug', () => {
  it('lowercases the key and kebabs the summary', () => {
    expect(jiraBranchSlug({ issue: issue({}) })).toBe('eng-142-session-rail-drops-focus');
  });
});

describe('buildIssueGroups', () => {
  it('orders in-progress before to-do and done, newest first inside a group', () => {
    const groups = buildIssueGroups({
      issues: [
        issue({ id: '1', statusCategory: 'done' }),
        issue({ id: '2', statusCategory: 'new', updated: '2026-07-01T10:00:00.000Z' }),
        issue({ id: '3', statusCategory: 'new', updated: '2026-07-05T10:00:00.000Z' }),
        issue({ id: '4', statusCategory: 'indeterminate' }),
      ],
      sessionIdByExternalId: new Map(),
    });
    expect(groups.map((group) => group.label)).toEqual(['In progress', 'To do', 'Done']);
    expect(groups[1]?.rows.map((row) => row.issue.id)).toEqual(['3', '2']);
  });
});

describe('resolveIssueSessions', () => {
  it('matches a linked external task before falling back to the branch name', () => {
    const linked: SessionExternalTask = {
      provider: 'jira',
      externalId: '10042',
    } as SessionExternalTask;
    const byLink = resolveIssueSessions({
      issues: [issue({})],
      sessions: [session('sess-1')],
      sessionBranches: {},
      sessionExternalTasks: { 'sess-1': [linked] },
    });
    const byBranch = resolveIssueSessions({
      issues: [issue({})],
      sessions: [session('sess-2')],
      sessionBranches: { 'sess-2': 'ak/eng-142-session-rail-drops-focus' },
      sessionExternalTasks: {},
    });
    expect(byLink.get('10042')).toBe('sess-1');
    expect(byBranch.get('10042')).toBe('sess-2');
  });
});
