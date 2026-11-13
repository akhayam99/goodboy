import { describe, expect, it } from 'vitest';
import { browserFailureText } from './browserFailureText';

describe('browserFailureText', () => {
  it('says the page changed when a capture lost its navigation', () => {
    expect(browserFailureText({ error: { kind: 'refused', message: 'page-moved' } })).toBe(
      'The page changed while it was read. Send it again.',
    );
  });

  it('keeps the moved host apart from a changed page', () => {
    expect(browserFailureText({ error: { kind: 'refused', message: 'host-unknown' } })).toBe(
      'The page moved to another site. Send it again.',
    );
  });
});
