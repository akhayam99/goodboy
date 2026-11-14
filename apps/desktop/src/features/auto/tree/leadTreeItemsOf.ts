import type { AgentId } from '@goodboy/types';
import type { LeadTree } from './leadTreeOf';
import type { NoteNode } from './noteNodesOf';
import { roleNameOf } from './roleNameOf';
import { rolePluralOf } from './rolePluralOf';

export type LeadTreeItem =
  | Readonly<{
      kind: 'agent';
      id: string;
      agentId: AgentId;
      depth: number;
      number: string;
      role: string;
      title: string;
      isSettled: boolean;
      spendUsd: number;
    }>
  | Readonly<{
      kind: 'fold';
      id: string;
      depth: number;
      count: number;
      label: string;
      isOpen: boolean;
      spendUsd: number;
    }>
  | Readonly<{
      kind: 'note';
      id: string;
      depth: number;
      text: string;
      word: string;
      canEdit: boolean;
      canRemove: boolean;
    }>;

export type LeadTreeAgentFact = Readonly<{
  agentId: AgentId;
  title: string;
}>;

type Params = {
  readonly tree: LeadTree;
  readonly agentsById: ReadonlyMap<string, LeadTreeAgentFact>;
  readonly notes: ReadonlyArray<NoteNode>;
};

export const leadTreeItemsOf = ({
  tree,
  agentsById,
  notes,
}: Params): ReadonlyArray<LeadTreeItem> => {
  const noteById = new Map(notes.map((note) => [note.id, note]));
  return tree.rows.flatMap((row): ReadonlyArray<LeadTreeItem> => {
    if (row.kind === 'agent') {
      const fact = agentsById.get(row.agentId);
      if (fact === undefined) {
        return [];
      }
      return [
        {
          kind: 'agent',
          id: row.id,
          agentId: fact.agentId,
          depth: row.depth,
          number: row.number,
          role: roleNameOf({ role: row.role }),
          title: fact.title,
          isSettled: row.isSettled,
          spendUsd: row.ownSpendUsd,
        },
      ];
    }
    if (row.kind === 'fold') {
      return [
        {
          kind: 'fold',
          id: row.id,
          depth: row.depth,
          count: row.count,
          label: `${row.count} ${row.role === null ? 'agents' : rolePluralOf({ role: row.role })}`,
          isOpen: row.isOpen,
          spendUsd: row.spendUsd,
        },
      ];
    }
    const note = noteById.get(row.id);
    if (row.kind !== 'note' || note === undefined) {
      return [];
    }
    return [
      {
        kind: 'note',
        id: note.id,
        depth: row.depth,
        text: note.text,
        word: note.word,
        canEdit: note.canEdit,
        canRemove: note.canRemove,
      },
    ];
  });
};
