import { useContext, type ReactNode } from 'react';
import { FactCard, ROW_INTERACTIVE, cn, type FactCardSpec } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { agentKindPalette, type AgentKind } from '../../../features/session/agent-kind';
import { SpawnedTreeContext } from './spawnedTreeContext';

type Props = {
  readonly id: string;
  readonly level: number;
  readonly hasChildren: boolean;
  readonly glyph: ReactNode;
  readonly role: AgentKind | null;
  readonly title: string;
  readonly card: FactCardSpec;
  readonly word: string;
  readonly time: ReactNode;
  readonly isSelected: boolean;
  readonly onOpen: () => void;
};

const INDENT_STEP_PX = 16;

export const SpawnedTreeRow = ({
  id,
  level,
  hasChildren,
  glyph,
  role,
  title,
  card,
  word,
  time,
  isSelected,
  onOpen,
}: Props) => {
  const { activeId, setActiveId } = useContext(SpawnedTreeContext);
  const roleLabel = role === null ? null : agentKindPalette({ kind: role }).label;
  const isRoleNamed =
    roleLabel === null || roleLabel.startsWith(title) || title.startsWith(roleLabel);
  const label = [...new Set(isRoleNamed ? [title, word] : [roleLabel, title, word])].join(', ');
  const row = (
    <div
      role="treeitem"
      data-tree-id={id}
      data-spawned-row={level}
      aria-level={level}
      aria-expanded={hasChildren ? true : undefined}
      aria-selected={isSelected}
      aria-label={label}
      tabIndex={activeId === id ? 0 : -1}
      onFocus={() => setActiveId(id)}
      onClick={onOpen}
      className={cn(
        'flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-ui text-foreground',
        ROW_INTERACTIVE,
        isSelected && 'bg-selected',
      )}
    >
      <span aria-hidden className="shrink-0" style={{ width: (level - 1) * INDENT_STEP_PX }} />
      <span className="flex size-4 shrink-0 items-center justify-center">{glyph}</span>
      {role === null ? null : <AgentKindChip kind={role} density="glyph" isDecorative />}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {time}
    </div>
  );
  return (
    <FactCard card={card} side="left">
      {row}
    </FactCard>
  );
};
