// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BRANCH_MENU_DIFF, BRANCH_MENU_PULL_REQUEST, branchMenuRowsOf } from './branchPrimary';

describe('branchMenuRowsOf', () => {
  it('rates every row the menu can list', () => {
    const everyRow = [...BRANCH_MENU_PULL_REQUEST, ...BRANCH_MENU_DIFF];
    const rated = everyRow.filter((id) => branchMenuRowsOf({ ids: [id] }).has(id));

    expect(rated).toEqual(everyRow);
  });

  it('holds five rows when an open pull request could list ten', () => {
    const rows = branchMenuRowsOf({
      ids: [
        'pullRequest.merge',
        'pullRequest.editDetails',
        'pullRequest.requestReview',
        'pullRequest.convertToDraft',
        'pullRequest.close',
        'pullRequest.openOnGithub',
        'pullRequest.copyLink',
        'diff.push',
        'diff.rebase',
        'diff.copyPatch',
      ],
    });

    expect([...rows]).toEqual([
      'pullRequest.merge',
      'diff.push',
      'diff.rebase',
      'pullRequest.close',
      'pullRequest.openOnGithub',
    ]);
  });

  it('keeps Archive session on a merged branch', () => {
    const rows = branchMenuRowsOf({
      ids: [
        'pullRequest.openOnGithub',
        'pullRequest.copyLink',
        'diff.rebase',
        'diff.copyPatch',
        'diff.archiveSession',
      ],
    });

    expect(rows.has('diff.archiveSession')).toBe(true);
    expect(rows.size).toBe(5);
  });
});
