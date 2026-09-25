import { describe, expect, it } from 'vitest';
import { firstSentence } from './firstSentence';

describe('firstSentence', () => {
  it('keeps the first sentence of a comment on one line', () => {
    expect(
      firstSentence({
        text: 'This retries forever on a 429.\nIt keeps hammering the provider.',
      }),
    ).toBe('This retries forever on a 429.');
  });

  it('keeps a comment without a full stop whole', () => {
    expect(firstSentence({ text: 'Use the config value v2.1 here' })).toBe(
      'Use the config value v2.1 here',
    );
  });
});
