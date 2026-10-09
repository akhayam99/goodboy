// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { BranchTab } from '../../store/slices/navigation/types';
import { branchLandingTabOf } from './branchLandingTab';

const TABS: ReadonlyArray<BranchTab> = ['pr', 'comments', 'files', 'commits', 'checks'];

describe('branchLandingTabOf', () => {
  it('lands on the pull request when the active mount has one', () => {
    expect(branchLandingTabOf({ hasPullRequest: true, deepLink: null })).toBe('pr');
  });

  it('lands on Files when the branch has no pull request yet', () => {
    expect(branchLandingTabOf({ hasPullRequest: false, deepLink: null })).toBe('files');
  });

  it.each(TABS)('lets an explicit %s tab win over the rule', (tab) => {
    expect(branchLandingTabOf({ hasPullRequest: true, deepLink: tab })).toBe(tab);
    expect(branchLandingTabOf({ hasPullRequest: false, deepLink: tab })).toBe(tab);
  });
});
