import { describe, expect, it } from 'vitest';
import { wordDiff } from './wordDiff';

describe('wordDiff', () => {
  it('marks only the words that changed', () => {
    const diff = wordDiff({
      before: 'Fine to keep the 5 second default.',
      after: 'Fine to cap the backoff at 30 seconds.',
    });
    expect(diff.before.filter((segment) => segment.isChanged).map((s) => s.text)).toEqual([
      'keep',
      '5 second default.',
    ]);
    expect(diff.after.filter((segment) => segment.isChanged).map((s) => s.text)).toEqual([
      'cap',
      'backoff at 30 seconds.',
    ]);
  });

  it('keeps both sides whole when nothing changed', () => {
    const diff = wordDiff({ before: 'Same text.', after: 'Same text.' });
    expect(diff.before).toEqual([{ text: 'Same text.', isChanged: false }]);
    expect(diff.after).toEqual([{ text: 'Same text.', isChanged: false }]);
  });

  it('marks an appended sentence as added and leaves the old text alone', () => {
    const diff = wordDiff({ before: 'Move it.', after: 'Move it. Also cap it.' });
    expect(diff.before.every((segment) => !segment.isChanged)).toBe(true);
    expect(diff.after.at(-1)).toEqual({ text: 'Also cap it.', isChanged: true });
  });
});
