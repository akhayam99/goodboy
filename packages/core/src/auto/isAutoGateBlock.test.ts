import { describe, expect, it } from 'vitest';
import { isAutoBudgetBlock } from './isAutoBudgetBlock';
import { autoRefusedBlockText, isAutoGateBlock } from './isAutoGateBlock';
import { LEGACY_GATE_TEXTS } from './legacyGateTexts';
import { AUTO_BLOCK_TEXT, AUTO_STALE_DECIDE_TEXT } from './turnGate';

describe('isAutoGateBlock', () => {
  it('reads every guard of the turn as a block that waits for the user', () => {
    for (const reason of Object.values(AUTO_BLOCK_TEXT)) {
      expect(isAutoGateBlock({ reason }), reason).toBe(true);
    }
  });

  it('keeps a tree stored with any text an older version wrote waiting for Retry or a message', () => {
    const stored = [
      LEGACY_GATE_TEXTS.noProgress,
      LEGACY_GATE_TEXTS.budget,
      LEGACY_GATE_TEXTS.returns,
      LEGACY_GATE_TEXTS.timeLimit,
      `${LEGACY_GATE_TEXTS.refusedPrefix} and was refused: the plan isn't approved yet. Retry to let it choose again, or tell it what to change.`,
    ];
    for (const reason of stored) {
      expect(isAutoGateBlock({ reason }), reason).toBe(true);
    }
  });

  it('reads a refusal written today as a gate block', () => {
    const reason = autoRefusedBlockText({ reason: "the plan isn't approved yet" });
    expect(isAutoGateBlock({ reason })).toBe(true);
  });

  it('leaves a provider problem and a lost turn to the restart retry', () => {
    expect(isAutoGateBlock({ reason: 'Claude is not signed in' })).toBe(false);
    expect(isAutoGateBlock({ reason: AUTO_STALE_DECIDE_TEXT })).toBe(false);
    expect(isAutoGateBlock({ reason: LEGACY_GATE_TEXTS.staleDecide })).toBe(false);
    expect(isAutoGateBlock({ reason: null })).toBe(false);
  });
});

describe('isAutoBudgetBlock', () => {
  it('reads the spend limit block in the words of today and of older versions', () => {
    expect(isAutoBudgetBlock({ reason: AUTO_BLOCK_TEXT.budget })).toBe(true);
    expect(isAutoBudgetBlock({ reason: LEGACY_GATE_TEXTS.budget })).toBe(true);
    expect(isAutoBudgetBlock({ reason: AUTO_BLOCK_TEXT.limit_no_progress })).toBe(false);
    expect(isAutoBudgetBlock({ reason: null })).toBe(false);
  });
});

describe('Lead block texts', () => {
  it('name the Lead and never the retired Auto', () => {
    expect(AUTO_BLOCK_TEXT.budget).toBe('The run reached its limit.');
    const texts = [
      AUTO_BLOCK_TEXT.limit_no_progress,
      AUTO_BLOCK_TEXT.limit_returns,
      AUTO_STALE_DECIDE_TEXT,
      autoRefusedBlockText({ reason: 'a narrower role fits the task' }),
    ];
    for (const text of texts) {
      expect(text, text).toContain('Lead');
      expect(text, text).not.toMatch(/\bAuto\b/);
      expect(text, text).not.toMatch(/Try again/);
    }
  });
});
