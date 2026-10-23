import { describe, expect, it } from 'vitest';
import { AUTO_DEFAULT_TREE_CAP_USD } from './limits';
import { autoTreeCapUsd } from './treeCap';
import { autoTreeLimitOf } from './treeLimitOf';

describe('the money cap a new Auto tree starts with', () => {
  it('takes the smallest of the session budget and the Auto limit of the workspace', () => {
    expect(autoTreeCapUsd({ sessionCapUsd: 25, workspaceLimitUsd: 8 })).toBe(8);
    expect(autoTreeCapUsd({ sessionCapUsd: 2, workspaceLimitUsd: 8 })).toBe(2);
    expect(autoTreeCapUsd({ sessionCapUsd: 25, workspaceLimitUsd: null })).toBe(
      AUTO_DEFAULT_TREE_CAP_USD,
    );
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

  it('names the limit that wins, so the line that says where it comes from is true', () => {
    expect(autoTreeLimitOf({ sessionCapUsd: 2, workspaceLimitUsd: 8 })).toEqual({
      usd: 2,
      source: 'session',
    });
    expect(autoTreeLimitOf({ sessionCapUsd: 25, workspaceLimitUsd: 8 })).toEqual({
      usd: 8,
      source: 'workspace',
    });
    expect(autoTreeLimitOf({ sessionCapUsd: 8, workspaceLimitUsd: 8 })).toEqual({
      usd: 8,
      source: 'workspace',
    });
    expect(autoTreeLimitOf({ sessionCapUsd: null, workspaceLimitUsd: null })).toEqual({
      usd: AUTO_DEFAULT_TREE_CAP_USD,
      source: 'default',
    });
  });
});
