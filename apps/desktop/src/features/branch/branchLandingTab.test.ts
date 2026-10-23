// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { BranchTab } from '../../store/slices/navigation/types';
import { branchLandingTabOf } from './branchLandingTab';

const TABS: ReadonlyArray<BranchTab> = ['pr', 'comments', 'files', 'commits', 'checks'];

describe('branchLandingTabOf', () => {
  it('lands on Pull request, the pull request or the branch page of a branch without one', () => {
    expect(branchLandingTabOf({ deepLink: null })).toBe('pr');
  });

  it.each(TABS)('lets an explicit %s tab win over the rule', (tab) => {
    expect(branchLandingTabOf({ deepLink: tab })).toBe(tab);
  });
});
