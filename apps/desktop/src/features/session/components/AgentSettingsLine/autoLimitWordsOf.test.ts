import { describe, expect, it } from 'vitest';
import { autoTreeCapUsd, type AutoBudgetFacts } from '@goodboy/core';
import { autoLimitWordsOf } from './autoLimitWordsOf';

type FactsParams = {
  readonly capUsd: number | null;
};

const factsOf = ({ capUsd }: FactsParams): AutoBudgetFacts => ({
  capUsd,
  spentUsd: 0.85,
  reservedUsd: 0,
  remainingUsd: capUsd === null ? null : capUsd - 0.85,
  hasEstimate: false,
});

type WordsParams = {
  readonly sessionCapUsd: number | null;
  readonly capUsd: number | null;
};

const wordsOf = ({ sessionCapUsd, capUsd }: WordsParams) =>
  autoLimitWordsOf({
    facts: factsOf({ capUsd }),
    sessionCapUsd,
    workspaceLimitUsd: 5,
    workspaceName: 'Harborline',
  });

describe('where the Auto limit comes from', () => {
  it('names the workspace when its Auto limit is the smallest', () => {
    const capUsd = autoTreeCapUsd({ sessionCapUsd: 8, workspaceLimitUsd: 5 });

    expect(wordsOf({ sessionCapUsd: 8, capUsd })).toEqual({
      value: '$0.85 of $5.00',
      source: 'from Harborline',
      chain: 'This Auto $5.00, then session $8.00, then Harborline $5.00. $5.00 comes first.',
    });
  });

  it('names the session when its limit is the smallest', () => {
    const capUsd = autoTreeCapUsd({ sessionCapUsd: 2, workspaceLimitUsd: 5 });

    expect(wordsOf({ sessionCapUsd: 2, capUsd })).toMatchObject({
      value: '$0.85 of $2.00',
      source: 'from session',
    });
  });

  it('names this Auto when its own limit was set on it', () => {
    expect(wordsOf({ sessionCapUsd: null, capUsd: 3 })).toMatchObject({
      value: '$0.85 of $3.00',
      source: 'this Auto',
      chain: 'This Auto $3.00, then session none, then Harborline $5.00. $3.00 comes first.',
    });
  });

  it('says nothing stops an Auto with no limit and no session limit', () => {
    expect(wordsOf({ sessionCapUsd: null, capUsd: null })).toMatchObject({
      value: '$0.85 spent',
      source: '',
    });
  });
});
