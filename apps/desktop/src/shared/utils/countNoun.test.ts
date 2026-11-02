import { describe, expect, it } from 'vitest';
import { countNoun } from './countNoun';

describe('countNoun', () => {
  it('writes the singular for exactly one', () => {
    expect(countNoun({ count: 1, one: 'thread' })).toBe('1 thread');
  });

  it('adds an s by default for zero and for many', () => {
    expect(countNoun({ count: 0, one: 'thread' })).toBe('0 threads');
    expect(countNoun({ count: 3, one: 'thread' })).toBe('3 threads');
  });

  it('takes an irregular or phrase plural from many', () => {
    expect(countNoun({ count: 1, one: 'comment needs', many: 'comments need' })).toBe(
      '1 comment needs',
    );
    expect(countNoun({ count: 2, one: 'comment needs', many: 'comments need' })).toBe(
      '2 comments need',
    );
    expect(countNoun({ count: 2, one: 'query', many: 'queries' })).toBe('2 queries');
  });
});
