import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { gitlabFetchAssignedMrs, type GitlabMergeRequest } from '../../client';
import { buildGitlabMrGroups, projectPathFromMrUrl, useGitlabMrs } from './index';

const h = vi.hoisted(() => ({
  workspaceIntegrations: {
    'workspace-1': [{ provider: 'gitlab', config: { host: 'https://gitlab.com' } }],
  },
}));

vi.mock('../../client', () => ({
  gitlabFetchAssignedMrs: vi.fn(),
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T>(
    selector: (state: { workspaceIntegrations: typeof h.workspaceIntegrations }) => T,
  ) => selector(h),
}));

const fetchAssignedMrs = vi.mocked(gitlabFetchAssignedMrs);

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

beforeEach(() => {
  fetchAssignedMrs.mockReset();
});

afterEach(cleanup);

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

  it('returns no project path for an unparseable MR URL', () => {
    expect(projectPathFromMrUrl({ webUrl: 'not a URL' })).toBeNull();
    expect(
      buildGitlabMrGroups({
        mrs: [makeMr({ overrides: { webUrl: 'not a URL' } })],
      })[0]?.label,
    ).toBe('Merge requests');
  });
});

describe('useGitlabMrs', () => {
  it('does not fetch assigned merge requests when disabled', () => {
    const { result } = renderHook(() =>
      useGitlabMrs({ workspaceId: 'workspace-1' as WorkspaceId, isEnabled: false }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.groups).toEqual([]);
    expect(fetchAssignedMrs).not.toHaveBeenCalled();
  });
});
