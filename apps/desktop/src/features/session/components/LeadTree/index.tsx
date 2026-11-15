import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import type { AgentId } from '@goodboy/types';
import { spawnedRailOf } from '../../../workTreeModel/spawnedRailOf';
import { LeadTreeAgentRow } from './LeadTreeAgentRow';
import { LeadTreeFoldRow } from './LeadTreeFoldRow';
import { LeadTreeNoteRow } from './LeadTreeNoteRow';
import { LeadTreeRootRow } from './LeadTreeRootRow';
import type { LeadTreeRoot } from './leadTreeRoot';
import type { LeadTreeItem } from '../../../auto/tree/leadTreeItemsOf';

export type LeadTreeDensity = 'full' | 'compact';

const ROOT_ROW_ID = 'lead-tree-root';

type Props = {
  readonly items: ReadonlyArray<LeadTreeItem>;
  readonly root?: LeadTreeRoot | null;
  readonly selectedAgentId: AgentId | null;
  readonly density?: LeadTreeDensity;
  readonly onSelect: (agentId: AgentId) => void;
  readonly onToggleFold?: (foldId: string) => void;
  readonly onEditNote: (noteId: string) => void;
  readonly onRemoveNote: (noteId: string) => void;
};

const ignoreFold = (): void => undefined;

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
  onEditNote,
  onRemoveNote,
}: Props) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const hasRoot = root !== null;
  const rail = useMemo(
    () =>
      spawnedRailOf({
        nodes: [
          ...(hasRoot ? [{ id: ROOT_ROW_ID, level: 1, isPending: false }] : []),
          ...items.map((item) => ({
            id: item.id,
            level: item.depth + (hasRoot ? 2 : 1),
            isPending: item.kind === 'agent' && item.node === 'queued',
          })),
        ],
      }),
    [items, hasRoot],
  );
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
    },
    [ids, items, root, cursorId, onSelect, onToggleFold],
  );
  const rootRail = rail.railById.get(ROOT_ROW_ID);

  return (
    <div
      role="tree"
      aria-label="Agents"
      tabIndex={0}
      data-testid="lead-tree"
      data-density={density}
      className="group/tree flex min-w-0 flex-col outline-none"
      onKeyDown={onKeyDown}
    >
      {root === null || rootRail === undefined ? null : (
        <LeadTreeRootRow
          id={ROOT_ROW_ID}
          root={root}
          rail={rootRail}
          railWidth={rail.width}
          isSelected={isRootSelected}
          isActive={cursorId === ROOT_ROW_ID}
          onSelect={onSelect}
        />
      )}
      {items.map((item) => {
        const isActive = item.id === cursorId;
        const itemRail = rail.railById.get(item.id);
        if (itemRail === undefined) {
          return null;
        }
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
              rail={itemRail}
              railWidth={rail.width}
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
              rail={itemRail}
              railWidth={rail.width}
              onToggle={onToggleFold}
            />
          );
        }
        return (
          <LeadTreeNoteRow
            key={item.id}
            id={item.id}
            rail={itemRail}
            railWidth={rail.width}
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
