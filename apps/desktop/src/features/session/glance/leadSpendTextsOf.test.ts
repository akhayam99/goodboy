import { describe, expect, it } from 'vitest';
import { leadSpendTextsOf } from './leadSpendTextsOf';

const SPLIT = { ownUsd: 3.9, runUsd: 10.04, hasHelpers: true };

describe('leadSpendTextsOf', () => {
  it('labels the Lead spend and the run total apart', () => {
    expect(leadSpendTextsOf({ spend: SPLIT, isLead: true })).toEqual({
      spend: 'Lead $3.90',
      spendTotal: 'Run total $10.04',
    });
  });

  it('says one figure for a Lead that has no helpers', () => {
    expect(
      leadSpendTextsOf({ spend: { ownUsd: 3.9, runUsd: 3.9, hasHelpers: false }, isLead: true }),
    ).toEqual({ spend: '$3.90', spendTotal: null });
  });

  it('says one figure, helpers included, for an agent that is not a Lead', () => {
    expect(leadSpendTextsOf({ spend: SPLIT, isLead: false })).toEqual({
      spend: '$10.04',
      spendTotal: null,
    });
  });

  it('keeps the run total when the Lead itself has spent less than a cent', () => {
    expect(
      leadSpendTextsOf({ spend: { ownUsd: 0, runUsd: 0.5, hasHelpers: true }, isLead: true }),
    ).toEqual({ spend: null, spendTotal: 'Run total $0.50' });
  });
});
