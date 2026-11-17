import { describe, expect, it } from 'vitest';
import { insertReplyPlaceholder } from './insertReplyPlaceholder';

describe('insertReplyPlaceholder', () => {
  it('adds the placeholder after the text when no caret is known', () => {
    expect(
      insertReplyPlaceholder({ text: 'Fixed in {commit}.\n', caret: null, name: 'reviewer' }),
    ).toBe('Fixed in {commit}. {reviewer}');
  });

  it('puts the placeholder at the caret with a space on each side that needs one', () => {
    expect(insertReplyPlaceholder({ text: 'Thanks for this', caret: 6, name: 'reviewer' })).toBe(
      'Thanks {reviewer} for this',
    );
    expect(insertReplyPlaceholder({ text: 'Thanks,\nDone.', caret: 8, name: 'reason' })).toBe(
      'Thanks,\n{reason} Done.',
    );
  });

  it('fills an empty template with the placeholder alone', () => {
    expect(insertReplyPlaceholder({ text: '', caret: 0, name: 'reason' })).toBe('{reason}');
  });
});
