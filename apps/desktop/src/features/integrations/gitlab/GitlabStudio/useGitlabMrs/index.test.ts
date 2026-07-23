import { describe, expect, it } from 'vitest';
import type { GitlabMergeRequest } from '../../client';
import { buildGitlabMrGroups, projectPathFromMrUrl } from './index';

type Params = {
  readonly overrides?: Partial<GitlabMergeRequest>;
};

const makeMr = ({ overrides = {} }: Params = {}): GitlabMergeRequest => ({
  id: 12,
  iid: 4,
  projectId: 3,
  title: 'Add merge request dashboard',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/merge_requests/4',
  sourceBranch: 'ak/mr-dashboard',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-07-22T10:00:00Z',
  ...overrides,
});

describe('useGitlabMrs helpers', () => {
  it('groups merge requests by project and sorts each group newest first', () => {
    const groups = buildGitlabMrGroups({
      mrs: [
        makeMr({ overrides: { id: 1, updatedAt: '2026-07-20T10:00:00Z' } }),
        makeMr({ overrides: { id: 2, updatedAt: '2026-07-23T10:00:00Z' } }),
        makeMr({
          overrides: {
            id: 3,
            webUrl: 'https://gitlab.com/acme/api/-/merge_requests/8',
          },
        }),
      ],
    });

    expect(groups.map((group) => group.key)).toEqual(['acme/api', 'acme/web']);
    expect(groups[1]?.rows.map((mr) => mr.id)).toEqual([2, 1]);
  });

  it('extracts a nested project path from an MR URL', () => {
    expect(
      projectPathFromMrUrl({
        webUrl: 'https://gitlab.com/group/subgroup/repo/-/merge_requests/9',
      }),
    ).toBe('group/subgroup/repo');
  });
});
