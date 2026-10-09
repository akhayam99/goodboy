import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId } from '@goodboy/types';
import { branchRowsOf } from './branchRowModels';

type BranchRowMount = Parameters<typeof branchRowsOf>[0]['mounts'][number];

const BRANCH_ROW_LIMIT = 5;

const mounts = (count: number): ReadonlyArray<BranchRowMount> =>
  Array.from({ length: count }, (_, index) => ({
    mountId: `mount-${index}` as MountId,
    projectId: 'project-payments-api' as ProjectId,
    mountName: 'payments-api',
    branch: index === 1 ? '' : `hl/branch-${index}`,
    worktreePath: `/work/${index}`,
  }));

const NO_REQUEST = () => null;

describe('branchRowsOf', () => {
  it('lists nothing for fewer than two branches', () => {
    expect(
      branchRowsOf({ mounts: mounts(1), currentPath: '/work/0', requestOf: NO_REQUEST }),
    ).toEqual({ shown: [], hasMore: false });
    expect(branchRowsOf({ mounts: [], currentPath: null, requestOf: NO_REQUEST }).shown).toEqual(
      [],
    );
  });

  it('lists every branch up to the limit without a more row', () => {
    const rows = branchRowsOf({
      mounts: mounts(BRANCH_ROW_LIMIT),
      currentPath: null,
      requestOf: NO_REQUEST,
    });
    expect(rows.shown).toHaveLength(BRANCH_ROW_LIMIT);
    expect(rows.hasMore).toBe(false);
  });

  it('cuts at the limit and says there are more', () => {
    const rows = branchRowsOf({ mounts: mounts(8), currentPath: '/work/0', requestOf: NO_REQUEST });
    expect(rows.shown).toHaveLength(BRANCH_ROW_LIMIT);
    expect(rows.hasMore).toBe(true);
  });

  it('keeps the current branch in view when it sits past the limit', () => {
    const rows = branchRowsOf({ mounts: mounts(8), currentPath: '/work/7', requestOf: NO_REQUEST });
    expect(rows.shown).toHaveLength(BRANCH_ROW_LIMIT);
    expect(rows.shown.at(-1)?.worktreePath).toBe('/work/7');
    expect(rows.shown.filter((row) => row.isCurrent)).toHaveLength(1);
  });

  it('names a branch by its mount when the branch name is empty', () => {
    const rows = branchRowsOf({ mounts: mounts(3), currentPath: null, requestOf: NO_REQUEST });
    expect(rows.shown[1]?.label).toBe('payments-api');
    expect(rows.shown[0]?.label).toBe('hl/branch-0');
  });

  it('carries the pull request of each mount', () => {
    const request = { number: 331, state: 'open', isDraft: false } as const;
    const rows = branchRowsOf({
      mounts: mounts(2),
      currentPath: null,
      requestOf: (mount) => (mount.mountId === 'mount-1' ? request : null),
    });
    expect(rows.shown.map((row) => row.request)).toEqual([null, request]);
  });
});
