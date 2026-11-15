import type { LeadTreeTimed } from './leadTreeOf';

export type NoteSource = Readonly<{
  id: string;
  content: string;
  status: 'queued' | 'sending' | 'waits' | 'notDelivered';
}>;

export const QUEUED_NOTE_WORD = 'Queued';

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
};

export type NoteNodes = Readonly<{
  nodes: ReadonlyArray<NoteNode>;
  timed: ReadonlyArray<LeadTreeTimed>;
}>;

export const noteNodesOf = ({ rows, createdAtById }: Params): NoteNodes => {
  const nodes = rows.map((row): NoteNode => {
    const isSending = row.status === 'sending';
    return {
      id: row.id,
      createdAt: createdAtById.get(row.id) ?? 0,
      text: row.content,
      word: QUEUED_NOTE_WORD,
      canEdit: !isSending,
      canRemove: !isSending,
    };
  });
  return {
    nodes,
    timed: nodes.map((node) => ({ id: node.id, createdAt: node.createdAt })),
  };
};
