import { describe, expect, it } from 'vitest';
import { CANDIDATE_CAUSES } from './candidateCauses';

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
});
