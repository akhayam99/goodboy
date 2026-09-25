import { describe, expect, it } from 'vitest';
import { turnSpanEndReason } from './turnSpanEndReason';

describe('turnSpanEndReason', () => {
  it('names a cancelled turn cancelled even when it produced text', () => {
    expect(turnSpanEndReason({ wasCancelled: true, assistantText: 'partial' })).toBe('cancelled');
  });

  it('counts a turn that produced no text as failed', () => {
    expect(turnSpanEndReason({ wasCancelled: false, assistantText: '' })).toBe('failed');
  });

  it('marks a turn that ends on a blocking question as awaiting the user', () => {
    const assistantText =
      '<<ctx-question blocking="true">>Which branch should I target?<</ctx-question>>';
    expect(turnSpanEndReason({ wasCancelled: false, assistantText })).toBe('awaiting_user');
  });

  it('marks a turn with an answer and no blocking question as succeeded', () => {
    expect(turnSpanEndReason({ wasCancelled: false, assistantText: 'done' })).toBe('succeeded');
  });
});
