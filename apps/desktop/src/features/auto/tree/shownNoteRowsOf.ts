import type { AutoPendingMessage } from '../../../store/slices/auto-view/state';
import type { NoteSource } from './noteNodesOf';

type Params = {
  readonly rows: ReadonlyArray<NoteSource>;
  readonly pending: ReadonlyArray<AutoPendingMessage>;
};

export const shownNoteRowsOf = ({ rows, pending }: Params): ReadonlyArray<NoteSource> => {
  const noteById = new Map<string, string | null>();
  for (const message of pending) {
    noteById.set(message.rowId, message.noteText === undefined ? message.text : message.noteText);
  }
  return rows.flatMap((row): ReadonlyArray<NoteSource> => {
    const note = noteById.get(row.id);
    if (note === undefined) {
      return [row];
    }
    return note === null ? [] : [{ ...row, content: note }];
  });
};
