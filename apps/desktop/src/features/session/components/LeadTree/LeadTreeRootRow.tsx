import { memo } from 'react';
import type { AgentId } from '@goodboy/types';
import { WorkNode, cn, tintClasses } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { LeadTreeBrief } from './LeadTreeBrief';
import { LeadTreeGuide } from './LeadTreeGuide';
import type { LeadTreeGuide as Guide } from './leadTreeGuidesOf';
import { LeadTreeSelectedMark } from './LeadTreeSelectedMark';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_METER } from './leadTreeMeter';
import { LEAD_TREE_QUIET_NODES } from './leadTreeQuietNodes';
import type { LeadTreeRoot } from './leadTreeRoot';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly root: LeadTreeRoot;
  readonly guide: Guide;
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly onSelect: (agentId: AgentId) => void;
};

export const LeadTreeRootRow = memo(
  ({ id, root, guide, isSelected, isActive, onSelect }: Props) => (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-selected={isSelected}
      aria-current={isSelected ? 'true' : undefined}
      data-selected={isSelected}
      aria-label={`Run, ${root.title}, ${root.word}`}
      data-lead-tree-id={id}
      data-lead-tree-root={root.agentId}
      data-lead-tree-node={root.node}
      data-active={isActive}
      className={cn(
        LEAD_TREE_ROW,
        'cursor-pointer hover:bg-hover',
        isSelected && 'bg-selected hover:bg-selected',
        isActive && LEAD_TREE_CURSOR,
      )}
      onClick={() => onSelect(root.agentId)}
    >
      {isSelected ? <LeadTreeSelectedMark /> : null}
      <LeadTreeGuide
        guide={guide}
        marker={
          <WorkNode
            look="quiet"
            state={root.node}
            label={root.word}
            mark={{ kind: 'dot' }}
            size="sm"
          />
        }
      />
      <AgentKindChip
        kind="auto"
        density="glyph"
        title="Lead"
        className={cn(isSelected && 'ring-1 ring-primary')}
      />
      <LeadTreeBrief text={root.title} className="text-foreground" />
      {LEAD_TREE_QUIET_NODES.has(root.node) ? null : (
        <span
          className={cn(
            'shrink-0 text-meta',
            root.node === 'failed' ? tintClasses('danger').text : 'text-muted-foreground',
          )}
        >
          {root.word}
        </span>
      )}
      <span aria-hidden data-lead-tree-meter="" className={LEAD_TREE_METER} />
    </div>
  ),
);

LeadTreeRootRow.displayName = 'LeadTreeRootRow';
