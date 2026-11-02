// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { branchNamedInGoal } from './branchNamedInGoal';

const BRANCHES = [
  'main',
  'ak/poc-start-funnel-subdomain',
  'ak/checkout-retries',
  'release_candidate',
  'hotfix',
];

const matchOf = ({ goal }: { readonly goal: string }) =>
  branchNamedInGoal({ goal, branches: BRANCHES, baseBranch: 'main' });

describe('branchNamedInGoal', () => {
  it('adopts a full branch name written after an Italian phrasing', () => {
    expect(matchOf({ goal: 'lavora sul branch: ak/poc-start-funnel-subdomain' })).toEqual({
      kind: 'one',
      branch: 'ak/poc-start-funnel-subdomain',
    });
  });

  it('adopts a full branch name written in English, quoted or backticked', () => {
    expect(matchOf({ goal: 'Work on branch `ak/checkout-retries`, then add tests.' })).toEqual({
      kind: 'one',
      branch: 'ak/checkout-retries',
    });
    expect(matchOf({ goal: 'continue on "ak/checkout-retries".' })).toEqual({
      kind: 'one',
      branch: 'ak/checkout-retries',
    });
  });

  it('reads an origin prefix as the same branch', () => {
    expect(matchOf({ goal: 'pick up origin/ak/checkout-retries' })).toEqual({
      kind: 'one',
      branch: 'ak/checkout-retries',
    });
  });

  it('never adopts a partial or fuzzy match', () => {
    expect(matchOf({ goal: 'work on ak/checkout' })).toEqual({ kind: 'none' });
    expect(matchOf({ goal: 'work on the checkout-retries flow' })).toEqual({ kind: 'none' });
    expect(matchOf({ goal: 'work on ak/checkout-retries-2' })).toEqual({ kind: 'none' });
  });

  it('keeps the new name when the goal only uses a plain word that is also a branch', () => {
    expect(matchOf({ goal: 'fix the main page after the hotfix' })).toEqual({ kind: 'none' });
    expect(matchOf({ goal: 'work on `hotfix`' })).toEqual({ kind: 'one', branch: 'hotfix' });
  });

  it('never adopts the base branch', () => {
    expect(matchOf({ goal: 'branch from `main`' })).toEqual({ kind: 'none' });
  });

  it('reports every branch when the goal names two', () => {
    expect(
      matchOf({ goal: 'compare ak/checkout-retries with ak/poc-start-funnel-subdomain' }),
    ).toEqual({
      kind: 'many',
      branches: ['ak/checkout-retries', 'ak/poc-start-funnel-subdomain'],
    });
  });

  it('finds nothing in a goal that names no branch', () => {
    expect(matchOf({ goal: 'Ship the rebase row' })).toEqual({ kind: 'none' });
  });
});
