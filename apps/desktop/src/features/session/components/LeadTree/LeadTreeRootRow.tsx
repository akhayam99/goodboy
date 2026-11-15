import { memo } from 'react';
import type { AgentId } from '@goodboy/types';
import { Tooltip, WorkNode, cn } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import type { RailRow } from '../../../workTreeModel/railGeometry';
import { SpawnedRailCell } from '../SessionWorkspace/parts/TimelinePane/SpawnedRailCell';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_QUIET_NODES } from './leadTreeQuietNodes';
import type { LeadTreeRoot } from './leadTreeRoot';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly root: LeadTreeRoot;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly onSelect: (agentId: AgentId) => void;
};

export const LeadTreeRootRow = memo(
  ({ id, root, rail, railWidth, isSelected, isActive, onSelect }: Props) => (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-selected={isSelected}
      aria-label={`Run, ${root.title}, ${root.word}`}
      data-lead-tree-id={id}
      data-lead-tree-root={root.agentId}
      data-lead-tree-node={root.node}
      data-active={isActive}
      className={cn(
        LEAD_TREE_ROW,
        'cursor-pointer hover:bg-hover',
        isSelected && 'bg-selected',
        isActive && LEAD_TREE_CURSOR,
      )}
      onClick={() => onSelect(root.agentId)}
    >
      <SpawnedRailCell
        rail={rail}
        width={railWidth}
        marker={<WorkNode state={root.node} label={root.word} mark={{ kind: 'dot' }} size="sm" />}
      />
      <AgentKindChip kind="auto" density="glyph" isDecorative />
      <Tooltip content={root.title} anchorClassName="flex min-w-0 flex-1">
        <span data-lead-tree-title="" className="min-w-0 flex-1 truncate text-ui text-foreground">
          {root.title}
        </span>
      </Tooltip>
      {LEAD_TREE_QUIET_NODES.has(root.node) ? null : (
        <span className="shrink-0 text-meta text-muted-foreground">{root.word}</span>
      )}
    </div>
  ),
);

LeadTreeRootRow.displayName = 'LeadTreeRootRow';
