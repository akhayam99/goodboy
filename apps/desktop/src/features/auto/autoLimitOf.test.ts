import { describe, expect, it } from 'vitest';
import { autoLimitOf } from './autoLimitOf';

describe('autoLimitOf', () => {
  it('reads the stored amount as the default when nothing was typed', () => {
    expect(autoLimitOf({ storedUsd: 5, draftUsd: undefined, sessionCapUsd: null })).toEqual({
      usd: 5,
      isFromSession: false,
      isDefault: true,
      defaultUsd: 5,
    });
  });

  it('has no limit and no default tag when nothing is stored', () => {
    expect(autoLimitOf({ storedUsd: null, draftUsd: undefined, sessionCapUsd: null })).toEqual({
      usd: null,
      isFromSession: false,
      isDefault: false,
      defaultUsd: null,
    });
  });

  it('keeps a typed amount, drops the default tag and still knows the default', () => {
    expect(autoLimitOf({ storedUsd: 5, draftUsd: 8, sessionCapUsd: null })).toEqual({
      usd: 8,
      isFromSession: false,
      isDefault: false,
      defaultUsd: 5,
    });
  });

  it('treats a typed no limit as typed, not as the default', () => {
    expect(autoLimitOf({ storedUsd: 5, draftUsd: null, sessionCapUsd: null })).toEqual({
      usd: null,
      isFromSession: false,
      isDefault: false,
      defaultUsd: 5,
    });
  });

  it('follows a smaller session budget and is never a default', () => {
    expect(autoLimitOf({ storedUsd: 5, draftUsd: undefined, sessionCapUsd: 2 })).toEqual({
      usd: 2,
      isFromSession: true,
      isDefault: false,
      defaultUsd: 5,
    });
  });

  it('keeps its own amount when the session budget is larger', () => {
    const facts = autoLimitOf({ storedUsd: 5, draftUsd: undefined, sessionCapUsd: 20 });

    expect(facts.isFromSession).toBe(false);
    expect(facts.usd).toBe(5);
  });
});
