import type { AutoReadMessage } from '../../../store/slices/auto-view/state';
import type { LeadTreeNoteTimed } from './leadTreeOf';
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
  isRead: boolean;
  canEdit: boolean;
  canRemove: boolean;
}>;

type Params = {
  readonly rows: ReadonlyArray<NoteSource>;
  readonly createdAtById: ReadonlyMap<string, number>;
  readonly read: ReadonlyArray<AutoReadMessage>;
};

export type NoteNodes = Readonly<{
  nodes: ReadonlyArray<NoteNode>;
  timed: ReadonlyArray<LeadTreeNoteTimed>;
}>;

export const noteNodesOf = ({ rows, createdAtById, read }: Params): NoteNodes => {
  const queued = rows.map((row): NoteNode => {
    const isSending = row.status === 'sending';
    return {
      id: row.id,
      createdAt: createdAtById.get(row.id) ?? 0,
      text: row.content,
      word: noteWordOf({ turn: null }),
      isRead: false,
      canEdit: !isSending,
      canRemove: !isSending,
    };
  });
  const queuedIds = new Set(queued.map((node) => node.id));
  const readNodes = read
    .filter((message) => !queuedIds.has(message.rowId))
    .map((message): NoteNode => ({
      id: message.rowId,
      createdAt: message.createdAt,
      text: message.text,
      word: noteWordOf({ turn: message.turn }),
      isRead: true,
      canEdit: false,
      canRemove: false,
    }));
  const nodes = [...readNodes, ...queued];
  return {
    nodes,
    timed: nodes.map((node) => ({
      id: node.id,
      createdAt: node.createdAt,
      isQueued: !node.isRead,
    })),
  };
};
