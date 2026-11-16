// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { leadDefaultOf, parseRunDefault } from './runDefaultSetting';

describe('runDefaultSetting', () => {
  it('still reads a default saved before runs had one engine', () => {
    expect(parseRunDefault({ raw: 'plan' })).toBe('plan');
    expect(parseRunDefault({ raw: 'lead' })).toBe('lead');
    expect(parseRunDefault({ raw: 'auto' })).toBe('auto');
    expect(parseRunDefault({ raw: 'orchestrated' })).toBeNull();
    expect(parseRunDefault({ raw: undefined })).toBeNull();
  });

  it('reads a saved plan default as a Lead that asks before the plan', () => {
    expect(leadDefaultOf({ shape: 'plan' })).toEqual({
      shouldMatchPreset: false,
      shouldAskPlan: true,
    });
  });

  it('lets only the pick default give the Lead a preset that fits', () => {
    expect(leadDefaultOf({ shape: 'auto' })).toEqual({
      shouldMatchPreset: true,
      shouldAskPlan: false,
    });
    expect(leadDefaultOf({ shape: 'lead' })).toEqual({
      shouldMatchPreset: false,
      shouldAskPlan: false,
    });
  });
});
