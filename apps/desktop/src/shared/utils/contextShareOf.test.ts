import { describe, expect, it } from 'vitest';
import { contextShareOf } from './contextShareOf';

describe('contextShareOf', () => {
  it('gives the share of the window the context fills', () => {
    expect(contextShareOf({ tokens: 50_000, window: 200_000 })).toBe(0.25);
  });

  it('stops at a full window', () => {
    expect(contextShareOf({ tokens: 210_000, window: 200_000 })).toBe(1);
  });

  it('gives nothing without a size or a window', () => {
    expect(contextShareOf({ tokens: null, window: 200_000 })).toBeNull();
    expect(contextShareOf({ tokens: 50_000, window: null })).toBeNull();
    expect(contextShareOf({ tokens: 50_000, window: 0 })).toBeNull();
  });
});
