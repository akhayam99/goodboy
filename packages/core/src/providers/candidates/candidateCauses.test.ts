import { describe, expect, it } from 'vitest';
import { CANDIDATE_CAUSES, candidateCauseTextOf, candidateOrderFactOf } from './candidateCauses';

const ADJUSTMENTS_AN_OLDER_BUILD_READS: ReadonlyArray<string> = [
  'none',
  'unknown_model',
  'disconnected',
  'cooldown',
  'budget',
  'hidden',
  'unsupported_effort',
];

describe('CANDIDATE_CAUSES', () => {
  it('maps every cause to an adjustment word an older build already reads', () => {
    for (const { adjustment } of Object.values(CANDIDATE_CAUSES)) {
      expect(ADJUSTMENTS_AN_OLDER_BUILD_READS).toContain(adjustment);
    }
  });

  it('says every cause in a short plain line', () => {
    for (const { text } of Object.values(CANDIDATE_CAUSES)) {
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(110);
    }
  });

  it('names the provider in the two reasons that blame it', () => {
    expect(candidateCauseTextOf({ cause: 'writer', providerName: 'Cursor' })).toBe(
      'the Lead cannot stop Cursor from pushing on its own yet, so it gives Cursor only read-only jobs',
    );
    expect(candidateCauseTextOf({ cause: 'not-for-helpers', providerName: 'OpenCode' })).toBe(
      'the Lead cannot keep OpenCode read-only yet, so it does not use it',
    );
  });

  it('falls back to the plain sentence without a provider name', () => {
    expect(candidateCauseTextOf({ cause: 'writer', providerName: null })).toBe(
      'the Lead gives this provider only read-only jobs, since it cannot stop it from pushing on its own yet',
    );
    expect(candidateCauseTextOf({ cause: 'cooldown', providerName: 'Claude' })).toBe(
      CANDIDATE_CAUSES.cooldown.text,
    );
  });

  it('says the provider rank with the provider name', () => {
    expect(candidateOrderFactOf({ providerName: 'Claude', order: 1 })).toBe(
      'Claude is #1 in your order',
    );
  });
});
