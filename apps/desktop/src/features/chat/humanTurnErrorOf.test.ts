import { describe, expect, it } from 'vitest';
import { humanTurnErrorOf } from './humanTurnErrorOf';

describe('humanTurnErrorOf', () => {
  it('reads a provider limit in plain words', () => {
    expect(humanTurnErrorOf({ message: 'rate_limit_error: 429 too many requests' })).toBe(
      'The provider is limiting requests right now. Wait a moment, then retry.',
    );
  });

  it('keeps a message that has no known shape', () => {
    expect(humanTurnErrorOf({ message: 'the relay dropped the stream' })).toBe(
      'the relay dropped the stream',
    );
  });
});
