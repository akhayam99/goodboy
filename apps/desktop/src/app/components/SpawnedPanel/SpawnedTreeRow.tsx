import { useContext, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AgentId } from '@goodboy/types';
import { FactCard, ICON_SIZE, ROW_INTERACTIVE, cn, type FactCardSpec } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { agentKindPalette, type AgentKind } from '../../../features/session/agent-kind';
import type { RailRow } from '../../../features/workTreeModel/railGeometry';
import { SpawnedRailCell } from './SpawnedRailCell';
import type { SpawnedRowFold } from './spawnedRow';
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
  readonly isSelected: boolean;
  readonly fold?: SpawnedRowFold | null;
  readonly onOpen: () => void;
};

type CountParams = {
  readonly count: number;
};

const countWordOf = ({ count }: CountParams): string =>
  count === 1 ? '1 agent' : `${count} agents`;

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
  isSelected,
  fold = null,
  onOpen,
}: Props) => {
  const { activeId, setActiveId } = useContext(SpawnedTreeContext);
  const roleLabel = role === null ? null : agentKindPalette({ kind: role }).label;
  const isRoleNamed =
    roleLabel === null || roleLabel.startsWith(title) || title.startsWith(roleLabel);
  const isFolded = fold !== null && !fold.isExpanded;
  const countWord = fold === null ? null : countWordOf({ count: fold.count });
  const label = [
    ...new Set([
      ...(isRoleNamed ? [title] : [roleLabel, title]),
      ...(isFolded && countWord !== null ? [countWord] : []),
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
        'flex h-7 min-w-0 items-center gap-2 rounded-md pr-2 text-ui text-foreground',
        ROW_INTERACTIVE,
        isSelected && 'bg-selected',
      )}
    >
      <SpawnedRailCell rail={rail} width={railWidth} marker={glyph} />
      {role === null ? null : <AgentKindChip kind={role} density="glyph" />}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {isFolded && countWord !== null ? (
        <span data-spawned-count="" className="shrink-0 text-meta text-muted-foreground">
          {countWord}
        </span>
      ) : null}
      {fold === null ? null : (
        <span
          aria-hidden
          data-testid="spawned-fold-toggle"
          onClick={onToggleClick}
          className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
        >
          <Chevron size={ICON_SIZE.row} />
        </span>
      )}
      {time}
    </div>
  );
  return (
    <FactCard card={card} side="left">
      {row}
    </FactCard>
  );
};
