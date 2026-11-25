import { memo } from 'react';
import type { AgentId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { LeadTreeBrief } from './LeadTreeBrief';
import { LeadTreeSelectedMark } from './LeadTreeSelectedMark';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { leadTreeInkOf } from './leadTreeInkOf';
import { LEAD_TREE_METER } from './leadTreeMeter';
import { LEAD_TREE_QUIET_NODES } from './leadTreeQuietNodes';
import type { LeadTreeRoot } from './leadTreeRoot';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly root: LeadTreeRoot;
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly onSelect: (agentId: AgentId) => void;
};

export const LeadTreeRootRow = memo(({ id, root, isSelected, isActive, onSelect }: Props) => {
  const ink = leadTreeInkOf({ node: root.node });
  return (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-selected={isSelected}
      aria-current={isSelected ? 'true' : undefined}
      aria-label={`Run, ${root.title}, ${root.word}`}
      data-selected={isSelected}
      data-lead-tree-id={id}
      data-lead-tree-root={root.agentId}
      data-lead-tree-node={root.node}
      data-active={isActive}
      className={cn(
        LEAD_TREE_ROW,
        'h-8 cursor-pointer hover:bg-hover',
        isSelected && 'bg-selected hover:bg-selected',
        isActive && LEAD_TREE_CURSOR,
      )}
      onClick={() => onSelect(root.agentId)}
    >
      {isSelected ? <LeadTreeSelectedMark /> : null}
      <AgentKindChip kind="auto" density="bare" title="Lead" className={ink.glyph} />
      <LeadTreeBrief text={root.title} className="text-row-strong text-foreground" />
      {LEAD_TREE_QUIET_NODES.has(root.node) ? null : (
        <span data-lead-tree-word="" className={cn('shrink-0 text-meta', ink.word)}>
          {root.word}
        </span>
      )}
      <span aria-hidden data-lead-tree-meter="" className={LEAD_TREE_METER} />
    </div>
  );
});

LeadTreeRootRow.displayName = 'LeadTreeRootRow';
