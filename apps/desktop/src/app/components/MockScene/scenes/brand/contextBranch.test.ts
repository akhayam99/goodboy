import { describe, expect, it } from 'vitest';
import { branchPushFactsOf } from '../../../../../shared/lib/branchPushState';
import { CTX_COMMITS, CTX_STATUS } from './contextBranch';

describe('branch scene data', () => {
  it('counts the commits to push the same way in the status and in the list', () => {
    const unpushed = CTX_COMMITS.filter((commit) => !commit.pushed).length;

    expect(branchPushFactsOf({ status: CTX_STATUS }).toPush).toBe(unpushed);
  });
});
