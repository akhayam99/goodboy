import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { GitlabIssue, GitlabMergeRequest } from '../../integrations/gitlab/client';
import type { GitlabIssueGroup } from '../../integrations/gitlab/GitlabStudio/useGitlabIssues';
import type { GitlabMrGroup } from '../../integrations/gitlab/GitlabStudio/useGitlabMrs';
import { adaptGitlab } from './gitlab';

const issue = (overrides: Partial<GitlabIssue> = {}): GitlabIssue => ({
  id: 101,
  iid: 7,
  projectId: 5,
  title: 'Investigate flaky pipeline',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/goodboy/goodboy/-/issues/7',
  references: { full: 'goodboy/goodboy#7' },
  updatedAt: '2026-08-01T10:00:00Z',
  milestone: null,
  labels: [],
  ...overrides,
});

const mr = (overrides: Partial<GitlabMergeRequest> = {}): GitlabMergeRequest => ({
  id: 202,
  iid: 12,
  projectId: 5,
  title: 'Add inbox adapters',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/goodboy/goodboy/-/merge_requests/12',
  sourceBranch: 'feat/inbox',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-08-02T10:00:00Z',
  ...overrides,
});

describe('adaptGitlab', () => {
  it('maps an issue row into a normalized inbox record', () => {
    const sessionId = 'session-1' as SessionId;
    const issueGroups: ReadonlyArray<GitlabIssueGroup> = [
      { key: 'goodboy', label: 'goodboy/goodboy', rows: [{ issue: issue(), sessionId }] },
    ];

    const records = adaptGitlab({ issueGroups, mrGroups: [], host: 'gitlab.com' });

    expect(records).toEqual([
      {
        key: 'gitlab:issue:101',
        provider: 'gitlab',
        kind: 'issue',
        identifier: 'goodboy/goodboy#7',
        title: 'Investigate flaky pipeline',
        state: 'open',
        updatedAt: '2026-08-01T10:00:00Z',
        url: 'https://gitlab.com/goodboy/goodboy/-/issues/7',
        meta: 'goodboy/goodboy',
        payload: { provider: 'gitlab', kind: 'issue', issue: issue(), sessionId },
      },
    ]);
  });

  it('maps a merge request row and carries the host through the payload', () => {
    const mrGroups: ReadonlyArray<GitlabMrGroup> = [
      { key: 'goodboy', label: 'goodboy/goodboy', rows: [mr()] },
    ];

    const records = adaptGitlab({ issueGroups: [], mrGroups, host: 'gitlab.com' });

    expect(records).toEqual([
      {
        key: 'gitlab:mr:202',
        provider: 'gitlab',
        kind: 'mr',
        identifier: '!12',
        title: 'Add inbox adapters',
        state: 'open',
        updatedAt: '2026-08-02T10:00:00Z',
        url: 'https://gitlab.com/goodboy/goodboy/-/merge_requests/12',
        meta: 'goodboy/goodboy',
        payload: { provider: 'gitlab', kind: 'mr', mr: mr(), host: 'gitlab.com' },
      },
    ]);
  });

  it.each([
    ['opened', 'open'],
    ['open', 'open'],
    ['merged', 'done'],
    ['closed', 'done'],
    ['locked', 'active'],
  ] as const)('normalizes issue state %s to %s', (state, expected) => {
    const issueGroups: ReadonlyArray<GitlabIssueGroup> = [
      { key: 'g', label: 'g', rows: [{ issue: issue({ state }), sessionId: null }] },
    ];

    const [record] = adaptGitlab({ issueGroups, mrGroups: [], host: null });

    expect(record?.state).toBe(expected);
  });

  it.each([
    ['opened', 'open'],
    ['merged', 'done'],
    ['closed', 'done'],
    ['locked', 'active'],
  ] as const)('normalizes merge request state %s to %s', (state, expected) => {
    const mrGroups: ReadonlyArray<GitlabMrGroup> = [
      { key: 'g', label: 'g', rows: [mr({ state })] },
    ];

    const [record] = adaptGitlab({ issueGroups: [], mrGroups, host: null });

    expect(record?.state).toBe(expected);
  });
});
