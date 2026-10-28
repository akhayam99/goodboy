import { describe, expect, it } from 'vitest';
import { autoTreeCapUsd } from './treeCap';
import { autoTreeLimitOf } from './treeLimitOf';

describe('the money cap a new Auto tree starts with', () => {
  it('takes the smallest of the session budget and the Auto limit of the workspace', () => {
    expect(autoTreeCapUsd({ sessionCapUsd: 25, workspaceLimitUsd: 8 })).toBe(8);
    expect(autoTreeCapUsd({ sessionCapUsd: 2, workspaceLimitUsd: 8 })).toBe(2);
    expect(autoTreeCapUsd({ sessionCapUsd: 2, workspaceLimitUsd: null })).toBe(2);
  });

  it('has no cap when nobody set a limit', () => {
    expect(autoTreeCapUsd({ sessionCapUsd: null, workspaceLimitUsd: 8 })).toBe(8);
    expect(autoTreeCapUsd({ sessionCapUsd: null, workspaceLimitUsd: null })).toBeNull();
  });

  it('never starts a tree on a cap that is zero, negative or not a number', () => {
    expect(autoTreeCapUsd({ sessionCapUsd: 0, workspaceLimitUsd: 8 })).toBe(8);
    expect(autoTreeCapUsd({ sessionCapUsd: Number.NaN, workspaceLimitUsd: -1 })).toBeNull();
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
    expect(autoTreeLimitOf({ sessionCapUsd: 3, workspaceLimitUsd: null })).toEqual({
      usd: 3,
      source: 'session',
    });
    expect(autoTreeLimitOf({ sessionCapUsd: null, workspaceLimitUsd: null })).toEqual({
      usd: null,
      source: 'none',
    });
  });
});
