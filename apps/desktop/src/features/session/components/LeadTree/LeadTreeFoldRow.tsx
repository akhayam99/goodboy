import { memo } from 'react';
import { ChevronDown, ChevronRight } from '@goodboy/ui/icons';
import { cn, ICON_SIZE } from '@goodboy/ui';
import { LEAD_TREE_UNIT, LeadTreeGuides } from './LeadTreeGuides';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly isOpen: boolean;
  readonly isActive: boolean;
  readonly depth: number;
  readonly onToggle: (id: string) => void;
};

export const LeadTreeFoldRow = memo(({ id, label, isOpen, isActive, depth, onToggle }: Props) => {
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-expanded={isOpen}
      aria-label={`${label}, done, ${isOpen ? 'unfolded' : 'folded'}`}
      data-lead-tree-id={id}
      data-active={isActive}
      className={cn(
        LEAD_TREE_ROW,
        'cursor-pointer text-muted-foreground hover:bg-hover',
        isActive && LEAD_TREE_CURSOR,
      )}
      onClick={() => onToggle(id)}
    >
      <LeadTreeGuides depth={depth} />
      <span aria-hidden className="shrink-0" style={{ width: depth * LEAD_TREE_UNIT }} />
      <span className="flex size-4 shrink-0 items-center justify-center">
        <Chevron size={ICON_SIZE.row} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-ui">{label}</span>
      <span className="shrink-0 text-meta">{isOpen ? 'done' : 'done · folded'}</span>
    </div>
  );
});

LeadTreeFoldRow.displayName = 'LeadTreeFoldRow';
