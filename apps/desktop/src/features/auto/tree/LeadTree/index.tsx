import { useCallback, useState, type KeyboardEvent } from 'react';
import type { AgentId } from '@goodboy/types';
import { LeadTreeAgentRow } from './LeadTreeAgentRow';
import { LeadTreeFoldRow } from './LeadTreeFoldRow';
import { LeadTreeNoteRow } from './LeadTreeNoteRow';
import type { LeadTreeItem } from '../leadTreeItemsOf';

export type LeadTreeDensity = 'full' | 'compact';

type Props = {
  readonly items: ReadonlyArray<LeadTreeItem>;
  readonly selectedAgentId: AgentId | null;
  readonly density?: LeadTreeDensity;
  readonly onSelect: (agentId: AgentId) => void;
  readonly onToggleFold: (foldId: string) => void;
  readonly onEditNote: (noteId: string) => void;
  readonly onRemoveNote: (noteId: string) => void;
};

type StepParams = {
  readonly ids: ReadonlyArray<string>;
  readonly from: string | null;
  readonly delta: 1 | -1;
};

const cursorStepOf = ({ ids, from, delta }: StepParams): string | null => {
  if (ids.length === 0) {
    return null;
  }
  const index = from === null ? -1 : ids.indexOf(from);
  if (index === -1) {
    return ids[delta === 1 ? 0 : ids.length - 1] ?? null;
  }
  return ids[Math.min(ids.length - 1, Math.max(0, index + delta))] ?? null;
};

export const LeadTree = ({
  items,
  selectedAgentId,
  density = 'full',
  onSelect,
  onToggleFold,
  onEditNote,
  onRemoveNote,
}: Props) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ids = items.map((item) => item.id);
  const selectedRowId =
    items.find((item) => item.kind === 'agent' && item.agentId === selectedAgentId)?.id ?? null;
  const cursorId =
    activeId !== null && ids.includes(activeId) ? activeId : (selectedRowId ?? ids[0] ?? null);
  const isCompact = density === 'compact';

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveId(
          cursorStepOf({ ids, from: cursorId, delta: event.key === 'ArrowDown' ? 1 : -1 }),
        );
        return;
      }
      if (event.key !== 'Enter' || event.target instanceof HTMLButtonElement) {
        return;
      }
      const item = items.find((candidate) => candidate.id === cursorId);
      if (item === undefined) {
        return;
      }
      event.preventDefault();
      if (item.kind === 'agent') {
        onSelect(item.agentId);
      }
      if (item.kind === 'fold') {
        onToggleFold(item.id);
      }
    },
    [ids, items, cursorId, onSelect, onToggleFold],
  );

  return (
    <div
      role="tree"
      aria-label="Agents"
      tabIndex={0}
      data-testid="lead-tree"
      data-density={density}
      className="flex min-w-0 flex-col gap-0.5 outline-none"
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const isActive = item.id === cursorId;
        if (item.kind === 'agent') {
          return (
            <LeadTreeAgentRow
              key={item.id}
              id={item.id}
              agentId={item.agentId}
              depth={item.depth}
              number={item.number}
              role={item.role}
              title={item.title}
              isSettled={item.isSettled}
              spendUsd={item.spendUsd}
              isSelected={item.agentId === selectedAgentId}
              isActive={isActive}
              isCompact={isCompact}
              onSelect={onSelect}
            />
          );
        }
        if (item.kind === 'fold') {
          return (
            <LeadTreeFoldRow
              key={item.id}
              id={item.id}
              depth={item.depth}
              label={item.label}
              isOpen={item.isOpen}
              spendUsd={item.spendUsd}
              isActive={isActive}
              onToggle={onToggleFold}
            />
          );
        }
        return (
          <LeadTreeNoteRow
            key={item.id}
            id={item.id}
            depth={item.depth}
            text={item.text}
            word={item.word}
            canEdit={item.canEdit}
            canRemove={item.canRemove}
            isActive={isActive}
            onEdit={onEditNote}
            onRemove={onRemoveNote}
          />
        );
      })}
    </div>
  );
};
