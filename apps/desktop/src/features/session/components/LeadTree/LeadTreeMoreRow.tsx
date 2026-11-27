import { memo } from 'react';
import { cn } from '@goodboy/ui';
import { LEAD_TREE_UNIT, LeadTreeGuides } from './LeadTreeGuides';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly count: number;
  readonly isActive: boolean;
  readonly depth: number;
  readonly onOpen: () => void;
};

export const LeadTreeMoreRow = memo(({ id, count, isActive, depth, onOpen }: Props) => {
  const label = `${count} more ${count === 1 ? 'message' : 'messages'} from you`;
  return (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-label={label}
      data-lead-tree-id={id}
      data-lead-tree-more=""
      data-active={isActive}
      className={cn(
        LEAD_TREE_ROW,
        'cursor-pointer text-meta text-faint-foreground hover:bg-hover',
        isActive && LEAD_TREE_CURSOR,
      )}
      onClick={onOpen}
    >
      <LeadTreeGuides depth={depth} />
      <span aria-hidden className="shrink-0" style={{ width: depth * LEAD_TREE_UNIT }} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </div>
  );
});

LeadTreeMoreRow.displayName = 'LeadTreeMoreRow';
