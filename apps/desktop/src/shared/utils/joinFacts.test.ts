// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { joinFacts } from './joinFacts';

describe('joinFacts', () => {
  it('joins facts with the one middle dot separator', () => {
    expect(joinFacts({ facts: ['Limit $3.00', '$1.12 spent'] })).toBe('Limit $3.00 · $1.12 spent');
  });

  it('skips empty parts so no separator is doubled or left dangling', () => {
    expect(joinFacts({ facts: ['Sonnet 5.5', null, '', '  ', undefined, false, '2m 37s'] })).toBe(
      'Sonnet 5.5 · 2m 37s',
    );
    expect(joinFacts({ facts: [null, 'Draft'] })).toBe('Draft');
  });

  it('trims each part so a fact never leaves a double gap at the separator', () => {
    expect(joinFacts({ facts: [' payments-api ', 'main '] })).toBe('payments-api · main');
  });

  it('returns an empty string when nothing is left', () => {
    expect(joinFacts({ facts: [null, ''] })).toBe('');
    expect(joinFacts({ facts: [] })).toBe('');
  });
});
