import { useContext } from 'react';
import { FactCard, PANE_RHYTHM, ROW_INTERACTIVE, WorkNode, cn } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { AgentRowModelLine } from '../../../features/providers/modelLine/AgentRowModelLine';
import { agentKindPalette, type AgentKind } from '../../../features/session/agent-kind';
import { agentActiveClock } from '../../../features/workTreeModel/agentWorkTime';
import { WorkTimeContext } from '../../../features/workTreeModel/workTimeSource';
import type { SpawnedRow } from './spawnedRow';
import { SpawnedTreeContext } from './spawnedTreeContext';

type Props = {
  readonly row: SpawnedRow;
  readonly level: 1 | 2;
  readonly fromRole: AgentKind | null;
  readonly isWorking: boolean;
  readonly isSelected: boolean;
  readonly onOpen: () => void;
};

type LabelParams = {
  readonly roleLabel: string;
  readonly title: string;
  readonly word: string;
};

const rowLabelOf = ({ roleLabel, title, word }: LabelParams): string => {
  const isRoleNamed = roleLabel.startsWith(title) || title.startsWith(roleLabel);
  return [...new Set([...(isRoleNamed ? [title] : [roleLabel, title]), word])].join(', ');
};

export const SpawnedStateRow = ({ row, level, fromRole, isWorking, isSelected, onOpen }: Props) => {
  const { activeId, setActiveId } = useContext(SpawnedTreeContext);
  const source = useContext(WorkTimeContext);
  const roleLabel = agentKindPalette({ kind: row.role }).label;
  const clock =
    source === null
      ? null
      : agentActiveClock({ agentId: row.agentId, unit: 'step', isRunning: row.isLive, source });
  const meta = [
    roleLabel,
    ...(fromRole === null ? [] : [`from ${agentKindPalette({ kind: fromRole }).label}`]),
    clock ?? row.word.toLowerCase(),
  ].join(' · ');
  return (
    <FactCard card={row.card} side="left">
      <div
        role="treeitem"
        data-tree-id={row.id}
        data-agent-id={row.agentId}
        data-spawned-row={row.level}
        data-spawned-state-row={isWorking ? 'working' : 'resting'}
        aria-level={level}
        aria-selected={isSelected}
        aria-label={rowLabelOf({ roleLabel, title: row.title, word: row.word })}
        tabIndex={activeId === row.id ? 0 : -1}
        onFocus={() => setActiveId(row.id)}
        onClick={onOpen}
        className={cn(
          '@container flex min-w-0 items-center gap-2 rounded-md',
          PANE_RHYTHM.tree.stateRow,
          ROW_INTERACTIVE,
          isSelected && 'bg-selected',
        )}
      >
        <WorkNode state={row.node} label={row.word} mark={{ kind: 'dot' }} size="sm" />
        <AgentKindChip kind={row.role} density="glyph" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              'line-clamp-2',
              isWorking ? 'text-row text-foreground' : 'text-ui text-muted-foreground',
            )}
          >
            {row.title}
          </span>
          <span className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
            <span data-spawned-meta="" className="truncate">
              {meta}
            </span>
            {row.model == null ? null : (
              <AgentRowModelLine
                agent={row.model.agent}
                routing={row.model.routing}
                className="hidden max-w-[40%] @min-[24rem]:inline-flex"
              />
            )}
          </span>
        </span>
      </div>
    </FactCard>
  );
};
