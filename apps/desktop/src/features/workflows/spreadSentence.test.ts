import { describe, expect, it } from 'vitest';
import { spreadSentence } from './spreadSentence';

const SWITCH_LABEL = 'Send new steps to the provider with the most room';

describe('spreadSentence', () => {
  it('says what changes when spread is on with no provider passed, not the switch label', () => {
    const sentence = spreadSentence({
      canSpread: true,
      spread: true,
      pick: { name: 'Claude', reason: { kind: 'most-room' } },
    });

    expect(sentence).toBe('Steps of one run can land on different providers.');
    expect(sentence.toLowerCase()).not.toContain('the provider with the most room');
    expect(SWITCH_LABEL.toLowerCase()).not.toContain(sentence.toLowerCase().replace(/\.$/, ''));
  });

  it('names the passed provider and where new steps go', () => {
    expect(
      spreadSentence({
        canSpread: true,
        spread: true,
        pick: { name: 'Codex', reason: { kind: 'passed-tight', passed: 'Claude', used: 0.92 } },
      }),
    ).toBe('Claude is at 92%, so new steps go to Codex first.');
  });

  it('keeps the provider order when spread is off', () => {
    expect(spreadSentence({ canSpread: true, spread: false, pick: null })).toBe(
      'New steps follow the provider order.',
    );
  });
});
