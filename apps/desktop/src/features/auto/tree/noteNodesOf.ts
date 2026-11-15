import type { AutoReadMessage } from '../../../store/slices/auto-view/state';
import type { LeadTreeTimed } from './leadTreeOf';
import { noteWordOf } from './noteWordOf';

export type NoteSource = Readonly<{
  id: string;
  content: string;
  status: 'queued' | 'sending' | 'waits' | 'notDelivered';
}>;

export type NoteNode = Readonly<{
  id: string;
  createdAt: number;
  text: string;
  word: string;
  canEdit: boolean;
  canRemove: boolean;
}>;

type Params = {
  readonly rows: ReadonlyArray<NoteSource>;
  readonly createdAtById: ReadonlyMap<string, number>;
  readonly isWork: boolean;
  readonly read: ReadonlyArray<AutoReadMessage>;
};

export type NoteNodes = Readonly<{
  nodes: ReadonlyArray<NoteNode>;
  timed: ReadonlyArray<LeadTreeTimed>;
}>;

export const noteNodesOf = ({ rows, createdAtById, isWork, read }: Params): NoteNodes => {
  const queued = rows.map((row): NoteNode => {
    const isSending = row.status === 'sending';
    return {
      id: row.id,
      createdAt: createdAtById.get(row.id) ?? 0,
      text: row.content,
      word: noteWordOf({ isWork, turn: null }),
      canEdit: !isSending,
      canRemove: !isSending,
    };
  });
  const queuedIds = new Set(queued.map((node) => node.id));
  const readNodes = isWork
    ? read
        .filter((message) => !queuedIds.has(message.rowId))
        .map((message): NoteNode => ({
          id: message.rowId,
          createdAt: message.createdAt,
          text: message.text,
          word: noteWordOf({ isWork, turn: message.turn }),
          canEdit: false,
          canRemove: false,
        }))
    : [];
  const nodes = [...readNodes, ...queued];
  return {
    nodes,
    timed: nodes.map((node) => ({ id: node.id, createdAt: node.createdAt })),
  };
};
