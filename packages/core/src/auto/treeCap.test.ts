import { describe, expect, it } from 'vitest';
import { AUTO_DEFAULT_TREE_CAP_USD } from './limits';
import { autoTreeCapUsd } from './treeCap';

describe('the money cap a new Auto tree starts with', () => {
  it('follows the budget of the session first, whatever the workspace says', () => {
    expect(autoTreeCapUsd({ sessionCapUsd: 25, workspaceLimitUsd: 8 })).toBe(25);
    expect(autoTreeCapUsd({ sessionCapUsd: 2, workspaceLimitUsd: 8 })).toBe(2);
  });

  it('falls back to the spend cap of the workspace, then to the default', () => {
    expect(autoTreeCapUsd({ sessionCapUsd: null, workspaceLimitUsd: 8 })).toBe(8);
    expect(autoTreeCapUsd({ sessionCapUsd: null, workspaceLimitUsd: null })).toBe(
      AUTO_DEFAULT_TREE_CAP_USD,
    );
  });

  it('never starts a tree on a cap that is zero, negative or not a number', () => {
    expect(autoTreeCapUsd({ sessionCapUsd: 0, workspaceLimitUsd: 8 })).toBe(8);
    expect(autoTreeCapUsd({ sessionCapUsd: Number.NaN, workspaceLimitUsd: -1 })).toBe(
      AUTO_DEFAULT_TREE_CAP_USD,
    );
  });
});
