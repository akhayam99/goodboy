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
      expect(text.length).toBeLessThanOrEqual(60);
    }
  });

  it('names the provider in the two reasons that blame it', () => {
    expect(candidateCauseTextOf({ cause: 'writer', providerName: 'Cursor' })).toBe(
      "cannot block Cursor's pushes yet, so read-only jobs only",
    );
    expect(candidateCauseTextOf({ cause: 'not-for-helpers', providerName: 'OpenCode' })).toBe(
      'cannot keep OpenCode read-only yet, so not used',
    );
  });

  it('falls back to the plain sentence without a provider name', () => {
    expect(candidateCauseTextOf({ cause: 'writer', providerName: null })).toBe(
      'cannot block its pushes yet, so read-only jobs only',
    );
    expect(candidateCauseTextOf({ cause: 'cooldown', providerName: 'Claude' })).toBe(
      CANDIDATE_CAUSES.cooldown.text,
    );
  });

  it('falls back to the plain sentence when the name makes it too long', () => {
    expect(
      candidateCauseTextOf({ cause: 'writer', providerName: 'A very long provider label' }),
    ).toBe(CANDIDATE_CAUSES.writer.text);
  });

  it('says the provider rank with the provider name', () => {
    expect(candidateOrderFactOf({ providerName: 'Claude', order: 1 })).toBe(
      'Claude is #1 in your order',
    );
  });
});
