import type { AgentId } from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';
import type { AgentKind } from '../../session/agent-kind';
import type { LeadTree } from './leadTreeOf';
import type { NoteNode } from './noteNodesOf';
import { NO_MARKS, type AgentMarks, type PermissionMark } from './markersOf';
import { roleNameOf } from './roleNameOf';
import { rolePluralOf } from './rolePluralOf';

export type LeadTreeItem =
  | Readonly<{
      kind: 'agent';
      id: string;
      agentId: AgentId;
      depth: number;
      number: string;
      agentKind: AgentKind;
      role: string;
      title: string;
      node: WorkNodeState;
      word: string;
      isSettled: boolean;
      spendUsd: number;
      permissions: ReadonlyArray<PermissionMark>;
    }>
  | Readonly<{
      kind: 'mark';
      id: string;
      depth: number;
      artifactId: string;
      label: string;
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
      isRead: boolean;
      canEdit: boolean;
      canRemove: boolean;
    }>
  | Readonly<{
      kind: 'more';
      id: string;
      depth: number;
      count: number;
    }>;

export type LeadTreeAgentFact = Readonly<{
  agentId: AgentId;
  title: string;
  agentKind: AgentKind;
  node: WorkNodeState;
  word: string;
}>;

type Params = {
  readonly tree: LeadTree;
  readonly agentsById: ReadonlyMap<string, LeadTreeAgentFact>;
  readonly notes: ReadonlyArray<NoteNode>;
  readonly marks?: ReadonlyMap<string, AgentMarks>;
};

const NO_MARK_MAP: ReadonlyMap<string, AgentMarks> = new Map();

export const leadTreeItemsOf = ({
  tree,
  agentsById,
  notes,
  marks = NO_MARK_MAP,
}: Params): ReadonlyArray<LeadTreeItem> => {
  const noteById = new Map(notes.map((note) => [note.id, note]));
  return tree.rows.flatMap((row): ReadonlyArray<LeadTreeItem> => {
    if (row.kind === 'agent') {
      const fact = agentsById.get(row.agentId);
      if (fact === undefined) {
        return [];
      }
      const agentMarks = marks.get(fact.agentId) ?? NO_MARKS;
      return [
        {
          kind: 'agent',
          id: row.id,
          agentId: fact.agentId,
          depth: row.depth,
          number: row.number,
          agentKind: fact.agentKind,
          role: roleNameOf({ role: row.role }),
          title: fact.title,
          node: fact.node,
          word: fact.word,
          isSettled: row.isSettled,
          spendUsd: row.ownSpendUsd,
          permissions: agentMarks.permissions,
        },
        ...agentMarks.labelled.map((mark): LeadTreeItem => ({
          kind: 'mark',
          id: `${mark.id}:${row.id}`,
          depth: row.depth + 1,
          artifactId: mark.artifactId,
          label: mark.label,
        })),
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
    if (row.kind === 'more') {
      return [{ kind: 'more', id: row.id, depth: row.depth, count: row.count }];
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
        isRead: note.isRead,
        canEdit: note.canEdit,
        canRemove: note.canRemove,
      },
    ];
  });
};
