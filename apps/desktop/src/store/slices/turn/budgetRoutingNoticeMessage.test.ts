import { describe, it, expect } from 'vitest';
import { budgetRoutingNoticeMessage, budgetRoutingReason } from './budgetRoutingNoticeMessage';

describe('budgetRoutingNoticeMessage', () => {
  it('names the threshold when the cap is not spent yet', () => {
    const message = budgetRoutingNoticeMessage({
      from: 'anthropic',
      to: 'codex',
      reason: 'fallback-threshold',
    });

    expect(message).toBe('anthropic is past its budget threshold. running this turn on codex.');
  });

  it('names the cap when the cap is spent', () => {
    const message = budgetRoutingNoticeMessage({
      from: 'anthropic',
      to: 'gemini',
      reason: 'fallback-budget',
    });

    expect(message).toBe('anthropic is over its monthly cap. running this turn on gemini.');
  });

  it('reads the two cases differently', () => {
    const threshold = budgetRoutingNoticeMessage({
      from: 'anthropic',
      to: 'codex',
      reason: 'fallback-threshold',
    });
    const cap = budgetRoutingNoticeMessage({
      from: 'anthropic',
      to: 'codex',
      reason: 'fallback-budget',
    });

    expect(threshold).not.toBe(cap);
  });

  it('carries no em-dash', () => {
    const message = budgetRoutingNoticeMessage({
      from: 'anthropic',
      to: 'codex',
      reason: 'fallback-threshold',
    });

    expect(message).not.toContain('\u2014');
  });
});

describe('budgetRoutingReason', () => {
  it('keeps the two budget reasons', () => {
    expect(budgetRoutingReason({ reason: 'fallback-budget' })).toBe('fallback-budget');
    expect(budgetRoutingReason({ reason: 'fallback-threshold' })).toBe('fallback-threshold');
  });

  it('drops the reasons that are not about budget', () => {
    expect(budgetRoutingReason({ reason: 'preferred' })).toBeNull();
    expect(budgetRoutingReason({ reason: 'override' })).toBeNull();
    expect(budgetRoutingReason({ reason: 'fallback-disconnected' })).toBe('fallback-disconnected');
    expect(budgetRoutingReason({ reason: 'all-exceeded' })).toBeNull();
  });

  it('tells the transcript when the preferred provider was unreachable', () => {
    expect(
      budgetRoutingNoticeMessage({
        from: 'anthropic',
        to: 'codex',
        reason: 'fallback-disconnected',
      }),
    ).toBe('anthropic is not reachable right now. running this turn on codex.');
  });
});
