import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionExternalTask, SessionId } from '@goodboy/types';
import type { GitlabMergeRequest } from '../integrations/gitlab/client';
import { branchRequests } from './branchRequests';
import { buildWorkItems } from './workItems';

const SESSION_ID = 'session-1' as SessionId;
const DATE = '2026-08-04T00:00:00.000Z' as IsoDateTime;

type MrParams = {
  readonly overrides?: Partial<GitlabMergeRequest>;
};

const makeMr = ({ overrides = {} }: MrParams): GitlabMergeRequest => ({
  id: 100,
  iid: 7,
  projectId: 3,
  title: 'Refactor authentication',
  description: null,
  state: 'merged',
  webUrl: 'https://gitlab.com/acme/goodboy/-/merge_requests/7',
  sourceBranch: 'ak/refactor-auth',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: DATE,
  ...overrides,
});

const task: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'GB-1',
  identifier: 'GB-1',
  url: 'https://linear.app/goodboy/issue/GB-1',
  title: 'Ship the work item',
  createdAt: DATE,
};

describe('branchRequests', () => {
  it('completes a work item from a merged merge request on the session branch', () => {
    const groups = buildWorkItems({
      tasks: [task],
      currentBranch: 'ak/refactor-auth',
      branchPrs: branchRequests({ prs: [], mr: makeMr({}), branch: 'ak/refactor-auth' }),
    });
    expect(groups.current).toEqual([]);
    expect(groups.history.map((item) => item.isCompleted)).toEqual([true]);
  });

  it('ignores a merge request opened from another branch', () => {
    const mr = makeMr({ overrides: { sourceBranch: 'ak/other-work' } });
    expect(branchRequests({ prs: [], mr, branch: 'ak/refactor-auth' })).toEqual([]);
  });
});
