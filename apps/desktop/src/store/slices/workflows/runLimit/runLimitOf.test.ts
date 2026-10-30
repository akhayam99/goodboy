import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { rulesWithLimit, runLimitOf } from './runLimitOf';

const RULES = { ...DEFAULT_WORKFLOW_RULES, spendLimitUsd: 25 };

describe('runLimitOf', () => {
  it('takes the workspace default only when the start said nothing', () => {
    expect(runLimitOf({ rules: RULES, spendLimitUsd: undefined, limitSource: undefined })).toEqual({
      usd: 25,
      mode: 'pause',
      source: 'default',
    });
  });

  it('adds no limit when the start said none', () => {
    expect(runLimitOf({ rules: RULES, spendLimitUsd: null, limitSource: undefined })).toEqual({
      usd: null,
      mode: 'pause',
      source: null,
    });
  });

  it('keeps the amount and the source the start showed', () => {
    expect(runLimitOf({ rules: RULES, spendLimitUsd: 8, limitSource: 'default' })).toMatchObject({
      usd: 8,
      source: 'default',
    });
    expect(runLimitOf({ rules: RULES, spendLimitUsd: 8, limitSource: undefined })).toMatchObject({
      usd: 8,
      source: 'run',
    });
  });

  it('writes the same amount and mode into the rules the run keeps', () => {
    const limit = runLimitOf({ rules: RULES, spendLimitUsd: null, limitSource: undefined });

    expect(rulesWithLimit({ rules: { ...RULES, limitSource: 'default' }, limit })).toEqual({
      ...DEFAULT_WORKFLOW_RULES,
      spendLimitUsd: null,
    });
  });
});
