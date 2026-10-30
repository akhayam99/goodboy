import { useContext, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AgentId } from '@goodboy/types';
import { FactCard, ICON_SIZE, ROW_INTERACTIVE, cn, type FactCardSpec } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { AgentRowModelLine } from '../../../features/providers/modelLine/AgentRowModelLine';
import { agentKindPalette, type AgentKind } from '../../../features/session/agent-kind';
import type { RailRow } from '../../../features/workTreeModel/railGeometry';
import { HelperUrgencyWord } from './HelperUrgencyWord';
import { helpersWordOf } from './helpersWordOf';
import { SpawnedRailCell } from './SpawnedRailCell';
import type { SpawnedRowFold, SpawnedRowModelSource } from './spawnedRow';
import { SpawnedTreeContext } from './spawnedTreeContext';

type Props = {
  readonly id: string;
  readonly agentId?: AgentId;
  readonly level: number;
  readonly hasChildren: boolean;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly glyph: ReactNode;
  readonly role: AgentKind | null;
  readonly title: string;
  readonly card: FactCardSpec;
  readonly word: string;
  readonly time: ReactNode;
  readonly model?: SpawnedRowModelSource | null;
  readonly isSelected: boolean;
  readonly fold?: SpawnedRowFold | null;
  readonly onOpen: () => void;
};

export const SpawnedTreeRow = ({
  id,
  agentId,
  level,
  hasChildren,
  rail,
  railWidth,
  glyph,
  role,
  title,
  card,
  word,
  time,
  model = null,
  isSelected,
  fold = null,
  onOpen,
}: Props) => {
  const { activeId, setActiveId } = useContext(SpawnedTreeContext);
  const roleLabel = role === null ? null : agentKindPalette({ kind: role }).label;
  const isRoleNamed =
    roleLabel === null || roleLabel.startsWith(title) || title.startsWith(roleLabel);
  const isFolded = fold !== null && !fold.isExpanded;
  const countWord = fold === null ? null : helpersWordOf({ count: fold.count });
  const urgency = isFolded ? (fold?.urgency ?? null) : null;
  const label = [
    ...new Set([
      ...(isRoleNamed ? [title] : [roleLabel, title]),
      ...(isFolded && countWord !== null ? [countWord] : []),
      ...(urgency === null ? [] : [urgency.word]),
      word,
    ]),
  ].join(', ');
  const Chevron = fold?.isExpanded === true ? ChevronDown : ChevronRight;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (fold === null) {
      return;
    }
    const isOpening = event.key === 'ArrowRight' && !fold.isExpanded;
    const isClosing = event.key === 'ArrowLeft' && fold.isExpanded;
    if (!isOpening && !isClosing) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    fold.onToggle();
  };
  const onToggleClick = (event: MouseEvent<HTMLSpanElement>): void => {
    event.stopPropagation();
    fold?.onToggle();
  };
  const row = (
    <div
      role="treeitem"
      data-tree-id={id}
      data-agent-id={agentId}
      data-spawned-row={level}
      aria-level={level}
      aria-expanded={fold === null ? (hasChildren ? true : undefined) : fold.isExpanded}
      aria-selected={isSelected}
      aria-label={label}
      tabIndex={activeId === id ? 0 : -1}
      onFocus={() => setActiveId(id)}
      onKeyDown={onKeyDown}
      onClick={onOpen}
      className={cn(
        '@container flex h-7 min-w-0 items-center gap-2 rounded-md pr-2 text-ui text-foreground',
        ROW_INTERACTIVE,
        isSelected && 'bg-selected',
      )}
    >
      <SpawnedRailCell rail={rail} width={railWidth} marker={glyph} />
      {role === null ? null : <AgentKindChip kind={role} density="glyph" />}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {model === null ? null : (
        <AgentRowModelLine
          agent={model.agent}
          routing={model.routing}
          className="hidden max-w-[40%] @min-[24rem]:inline-flex"
        />
      )}
      {isFolded && countWord !== null ? (
        <span data-spawned-count="" className="shrink-0 text-meta text-muted-foreground">
          {countWord}
        </span>
      ) : null}
      {urgency === null ? null : <HelperUrgencyWord urgency={urgency} />}
      <span
        aria-hidden
        data-testid={fold === null ? undefined : 'spawned-fold-toggle'}
        onClick={fold === null ? undefined : onToggleClick}
        className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
      >
        {fold === null ? null : <Chevron size={ICON_SIZE.row} />}
      </span>
      <span data-spawned-time="" className="flex w-12 shrink-0 justify-end">
        {time}
      </span>
    </div>
  );
  return (
    <FactCard card={card} side="left">
      {row}
    </FactCard>
  );
};
