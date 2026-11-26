import { describe, expect, it } from 'vitest';
import type { NoteSource } from './noteNodesOf';
import { shownNoteRowsOf } from './shownNoteRowsOf';

const row = (id: string, content: string): NoteSource => ({ id, content, status: 'queued' });

const pending = (rowId: string, text: string, noteText?: string | null) => ({
  rowId,
  createdAt: 1,
  text,
  images: [],
  ...(noteText !== undefined && { noteText }),
});

describe('shownNoteRowsOf', () => {
  it('keeps a composer row that Auto does not hold', () => {
    const rows = [row('q1', 'Also cover the batch endpoint')];

    expect(shownNoteRowsOf({ rows, pending: [] })).toEqual(rows);
  });

  it('drops an Auto row that carries no words of the user', () => {
    const rows = [row('a1', 'Permission for Grep is now granted.')];

    expect(
      shownNoteRowsOf({ rows, pending: [pending('a1', rows[0]?.content ?? '', null)] }),
    ).toEqual([]);
  });

  it('shows only the words of the user for an Auto row', () => {
    const rows = [row('a1', 'Denied Read. rename the guard')];

    expect(
      shownNoteRowsOf({
        rows,
        pending: [pending('a1', 'Denied Read. rename the guard', 'rename the guard')],
      }),
    ).toEqual([row('a1', 'rename the guard')]);
  });

  it('keeps the text of an Auto row that has no note field', () => {
    const rows = [row('a1', 'keep it')];

    expect(shownNoteRowsOf({ rows, pending: [pending('a1', 'keep it')] })).toEqual(rows);
  });
});
