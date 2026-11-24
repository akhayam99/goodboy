import { describe, expect, it } from 'vitest';
import { spreadSentence } from './spreadSentence';

describe('spreadSentence', () => {
  it('says when a provider is skipped and which providers report limits', () => {
    const sentence = spreadSentence({
      canSpread: true,
      spread: true,
      pick: { name: 'Claude', reason: { kind: 'most-room' } },
    });

    expect(sentence).toBe(
      'Past 80% of a limit, new agents start on the next provider. Only Claude and Codex report limits.',
    );
    expect(sentence.toLowerCase()).not.toContain('most room');
  });

  it('names the passed provider and where new agents start', () => {
    expect(
      spreadSentence({
        canSpread: true,
        spread: true,
        pick: { name: 'Codex', reason: { kind: 'passed-tight', passed: 'Claude', used: 0.92 } },
      }),
    ).toBe('Claude is at 92%, so new agents start on Codex.');
  });

  it('keeps the provider order when the switch is off', () => {
    expect(spreadSentence({ canSpread: true, spread: false, pick: null })).toBe(
      'New agents follow the provider order. Only Claude and Codex report limits.',
    );
  });

  it('says only Claude and Codex report limits when no On provider does', () => {
    expect(spreadSentence({ canSpread: false, spread: false, pick: null })).toBe(
      'Only Claude and Codex report limits. Turn one on to use this.',
    );
  });
});
