import { describe, expect, it } from 'vitest';
import { linearPrStateKind } from './linearPrStateKind';

describe('linearPrStateKind', () => {
  it('maps linear status text onto the shared pull request grammar', () => {
    expect(linearPrStateKind({ status: 'MERGED' })).toBe('merged');
    expect(linearPrStateKind({ status: 'closed' })).toBe('closed');
    expect(linearPrStateKind({ status: 'Draft' })).toBe('draft');
    expect(linearPrStateKind({ status: 'open' })).toBe('open');
  });

  it('admits it does not know rather than guessing a state', () => {
    expect(linearPrStateKind({ status: null })).toBeNull();
    expect(linearPrStateKind({ status: 'whatever' })).toBeNull();
  });
});
