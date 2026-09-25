import { describe, expect, it } from 'vitest';
import { fixtureMessage } from './testing/conversationFixtures';
import { quoteBody } from './quoteBody';

describe('quoteBody', () => {
  it('quotes the first three lines and keeps the reply below a blank line', () => {
    const message = fixtureMessage({ id: 'c1', name: 'Robin', body: 'one\n\ntwo\nthree\nfour' });

    expect(quoteBody({ message, text: 'agreed' })).toBe('> one\n> two\n> three\n\nagreed');
  });

  it('mentions the author when the tool has a handle for them', () => {
    const message = fixtureMessage({ id: 'c1', name: 'ana-r', handle: 'ana-r', body: 'hi' });

    expect(quoteBody({ message, text: 'yes' })).toBe('> hi\n\n@ana-r yes');
  });
});
