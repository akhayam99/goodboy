import { describe, expect, it } from 'vitest';
import { fixNotesLabel } from './notes/reviewNotesCopy';
import { fixLabel } from './reviewLaunchCopy';

describe('the Fix verb', () => {
  it.each([1, 2, 9])('reads Fix %i on the selection bar and the notes', (count) => {
    expect(fixLabel({ count })).toBe(`Fix ${count}`);
    expect(fixNotesLabel({ count })).toBe(fixLabel({ count }));
  });
});
