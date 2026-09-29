import { describe, expect, it } from 'vitest';
import { issueBranchMatches, issueBranchSlug, titleBranchSlug } from './issueBranchSlug';

const LONG_TITLE = "Harborline checkout: don't lose totals after a refund is applied";

describe('issueBranchSlug', () => {
  it('joins the issue prefix and the slugified title', () => {
    expect(issueBranchSlug({ prefix: '812', title: 'Fix the Login Bug!' })).toBe(
      '812-fix-the-login-bug',
    );
  });

  it('turns punctuation into a dash instead of deleting it', () => {
    expect(issueBranchSlug({ prefix: '812', title: 'Fix/login redirect' })).toBe(
      '812-fix-login-redirect',
    );
  });

  it('lowercases a tracker key', () => {
    expect(issueBranchSlug({ prefix: 'ENG-142', title: 'Rail drops focus' })).toBe(
      'eng-142-rail-drops-focus',
    );
  });

  it('is cut at the final branch budget, prefix included', () => {
    const slug = issueBranchSlug({ prefix: '812', title: LONG_TITLE });

    expect(slug).toBe('812-harborline-checkout-don-t-lose-totals-after');
    expect(slug.length).toBeLessThanOrEqual(48);
  });

  it('keeps only the prefix when the title has nothing usable', () => {
    expect(issueBranchSlug({ prefix: '812', title: '***' })).toBe('812');
  });
});

describe('titleBranchSlug', () => {
  it('returns an empty slug so the branch is derived from the goal instead', () => {
    expect(titleBranchSlug({ title: '\u{1F680}' })).toBe('');
  });

  it('honours a smaller budget', () => {
    expect(titleBranchSlug({ title: 'Harborline checkout totals drift', maxLength: 16 })).toBe(
      'harborline-check',
    );
  });
});

describe('issueBranchMatches', () => {
  const params = { prefix: '812', title: LONG_TITLE };

  it('matches the branch the current rule creates', () => {
    expect(
      issueBranchMatches({
        ...params,
        branch: 'ak/812-harborline-checkout-don-t-lose-totals-after',
      }),
    ).toBe(true);
  });

  it('still matches a branch made when punctuation was deleted', () => {
    expect(
      issueBranchMatches({
        ...params,
        branch: 'ak/812-harborline-checkout-dont-lose-totals-after-a',
      }),
    ).toBe(true);
  });

  it('matches a long issue whose branch was cut by the mount plan', () => {
    const untruncated = `812-${'harborline-checkout-totals-drift-after-refund'}`;
    expect(untruncated.length).toBeGreaterThan(48);
    expect(
      issueBranchMatches({
        prefix: '812',
        title: 'harborline checkout totals drift after refund',
        branch: `ak/${untruncated.slice(0, 48)}`,
      }),
    ).toBe(true);
  });

  it('ignores case and the branch prefix', () => {
    expect(
      issueBranchMatches({
        prefix: 'ENG-142',
        title: 'Rail drops focus',
        branch: 'Team/Ak/ENG-142-Rail-Drops-Focus',
      }),
    ).toBe(true);
  });

  it('rejects another issue and an empty branch', () => {
    expect(issueBranchMatches({ ...params, branch: 'ak/813-harborline-checkout' })).toBe(false);
    expect(issueBranchMatches({ ...params, branch: '' })).toBe(false);
  });
});
