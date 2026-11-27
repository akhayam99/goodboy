import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import type { AgentId } from '@goodboy/types';
import { LeadTreeAgentRow } from './LeadTreeAgentRow';
import { LeadTreeFoldRow } from './LeadTreeFoldRow';
import { LeadTreeMarkRow } from './LeadTreeMarkRow';
import { LeadTreeMoreRow } from './LeadTreeMoreRow';
import { LeadTreeNoteRow } from './LeadTreeNoteRow';
import { LeadTreeRootRow } from './LeadTreeRootRow';
import type { LeadTreeRoot } from './leadTreeRoot';
import type { LeadTreeItem } from '../../../auto/tree/leadTreeItemsOf';
import { NAMES } from '../../../../shared/utils/names';

export type LeadTreeDensity = 'full' | 'compact';

const ROOT_ROW_ID = 'lead-tree-root';

type Props = {
  readonly items: ReadonlyArray<LeadTreeItem>;
  readonly root?: LeadTreeRoot | null;
  readonly selectedAgentId: AgentId | null;
  readonly density?: LeadTreeDensity;
  readonly onSelect: (agentId: AgentId) => void;
  readonly onToggleFold?: (foldId: string) => void;
  readonly onOpenArtifact?: (artifactId: string) => void;
  readonly onEditNote: (noteId: string) => void;
  readonly onRemoveNote: (noteId: string) => void;
};

const ignoreFold = (): void => undefined;

const ignoreArtifact = (): void => undefined;

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
  root = null,
  selectedAgentId,
  density = 'full',
  onSelect,
  onToggleFold = ignoreFold,
  onOpenArtifact = ignoreArtifact,
  onEditNote,
  onRemoveNote,
}: Props) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const hasRoot = root !== null;
  const ids = useMemo(
    () => [...(hasRoot ? [ROOT_ROW_ID] : []), ...items.map((item) => item.id)],
    [hasRoot, items],
  );
  const isRootSelected = root !== null && root.agentId === selectedAgentId;
  const selectedRowId = isRootSelected
    ? ROOT_ROW_ID
    : (items.find((item) => item.kind === 'agent' && item.agentId === selectedAgentId)?.id ?? null);
  const cursorId =
    activeId !== null && ids.includes(activeId) ? activeId : (selectedRowId ?? ids[0] ?? null);
  const isCompact = density === 'compact';
  const onOpenLead = useCallback(() => {
    if (root !== null) {
      onSelect(root.agentId);
    }
  }, [root, onSelect]);

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
      if (root !== null && cursorId === ROOT_ROW_ID) {
        event.preventDefault();
        onSelect(root.agentId);
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
      if (item.kind === 'mark') {
        onOpenArtifact(item.artifactId);
      }
      if ((item.kind === 'note' || item.kind === 'more') && root !== null) {
        onSelect(root.agentId);
      }
    },
    [ids, items, root, cursorId, onSelect, onToggleFold, onOpenArtifact],
  );

  return (
    <div
      role="tree"
      aria-label={NAMES.agents}
      tabIndex={0}
      data-testid="lead-tree"
      data-density={density}
      className="group/tree flex min-w-0 flex-col outline-none"
      onKeyDown={onKeyDown}
    >
      {root === null ? null : (
        <LeadTreeRootRow
          id={ROOT_ROW_ID}
          root={root}
          isSelected={isRootSelected}
          isActive={cursorId === ROOT_ROW_ID}
          onSelect={onSelect}
        />
      )}
      {root === null || items.length === 0 ? null : (
        <div aria-hidden data-lead-tree-sep="" className="px-2 pb-1 pt-0.5">
          <div className="h-px bg-border-soft" />
        </div>
      )}
      {items.map((item) => {
        const isActive = item.id === cursorId;
        if (item.kind === 'agent') {
          return (
            <LeadTreeAgentRow
              key={item.id}
              id={item.id}
              agentId={item.agentId}
              number={item.number}
              kind={item.agentKind}
              role={item.role}
              title={item.title}
              node={item.node}
              word={item.word}
              isSettled={item.isSettled}
              spendUsd={item.spendUsd}
              permissions={item.permissions}
              depth={item.depth}
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
              label={item.label}
              isOpen={item.isOpen}
              isActive={isActive}
              depth={item.depth}
              onToggle={onToggleFold}
            />
          );
        }
        if (item.kind === 'mark') {
          return (
            <LeadTreeMarkRow
              key={item.id}
              id={item.id}
              artifactId={item.artifactId}
              label={item.label}
              depth={item.depth}
              isActive={isActive}
              onOpen={onOpenArtifact}
            />
          );
        }
        if (item.kind === 'more') {
          return (
            <LeadTreeMoreRow
              key={item.id}
              id={item.id}
              count={item.count}
              depth={item.depth}
              isActive={isActive}
              onOpen={onOpenLead}
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
            isRead={item.isRead}
            onOpen={onOpenLead}
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
