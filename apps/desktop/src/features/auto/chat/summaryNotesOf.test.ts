import { describe, expect, it } from 'vitest';
import { summaryNotesOf } from './summaryNotesOf';

describe('summaryNotesOf', () => {
  it('drops the outcome line and counts the lines left', () => {
    const notes = summaryNotesOf({
      summary: '<<outcome>>Done<</outcome>>\nChecked ledger-core.\n\nChecked notify-relay.',
      key: 'k',
      isOpen: false,
    });

    expect(notes?.lineCount).toBe(2);
    expect(notes?.notes[0]?.text).not.toContain('outcome');
    expect(notes?.isOpen).toBe(false);
  });

  it('gives nothing when only the outcome line or an artifact block is left', () => {
    expect(summaryNotesOf({ summary: null, key: 'k', isOpen: false })).toBeNull();
    expect(
      summaryNotesOf({ summary: '<<outcome>>Done<</outcome>>', key: 'k', isOpen: false }),
    ).toBeNull();
  });
});
