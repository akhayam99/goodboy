import { describe, expect, it } from 'vitest';
import { uniqueNameOf } from './uniqueNameOf';

describe('uniqueNameOf', () => {
  it('keeps a name nobody has taken', () => {
    expect(uniqueNameOf({ requested: 'Review', taken: ['Build'] })).toBe('Review');
  });

  it('adds the first free number after a taken name', () => {
    expect(uniqueNameOf({ requested: 'Review', taken: ['Review'] })).toBe('Review 2');
  });

  it('skips numbers that are taken too', () => {
    expect(uniqueNameOf({ requested: 'Review', taken: ['Review', 'Review 2', 'Review 3'] })).toBe(
      'Review 4',
    );
  });
});
