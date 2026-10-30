import { describe, expect, it } from 'vitest';
import { autoLimitOf } from './autoLimitOf';
import { startLimitOf } from './startLimitOf';

type LimitParams = {
  readonly storedUsd: number | null;
  readonly draftUsd: number | null | undefined;
  readonly sessionCapUsd: number | null;
};

const limitOf = ({ storedUsd, draftUsd, sessionCapUsd }: LimitParams) =>
  startLimitOf({ facts: autoLimitOf({ storedUsd, draftUsd, sessionCapUsd }) });

describe('startLimitOf', () => {
  it('hands the run the default amount, tagged as the default', () => {
    expect(limitOf({ storedUsd: 5, draftUsd: undefined, sessionCapUsd: null })).toEqual({
      usd: 5,
      source: 'default',
    });
  });

  it('hands the run a typed amount, tagged as this run', () => {
    expect(limitOf({ storedUsd: 5, draftUsd: 8, sessionCapUsd: null })).toEqual({
      usd: 8,
      source: 'run',
    });
  });

  it('hands the run no limit when the person chose none, though a default exists', () => {
    expect(limitOf({ storedUsd: 5, draftUsd: null, sessionCapUsd: null })).toEqual({
      usd: null,
      source: null,
    });
  });

  it('leaves the amount to the session cap when the cap is what the chip showed', () => {
    expect(limitOf({ storedUsd: 5, draftUsd: 8, sessionCapUsd: 3 })).toEqual({
      usd: null,
      source: null,
    });
  });
});
