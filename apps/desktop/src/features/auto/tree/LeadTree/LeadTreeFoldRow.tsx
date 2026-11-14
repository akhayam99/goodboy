import { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn, ICON_SIZE } from '@goodboy/ui';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { leadTreeIndentOf } from './leadTreeIndentOf';

type Props = {
  readonly id: string;
  readonly depth: number;
  readonly label: string;
  readonly isOpen: boolean;
  readonly isActive: boolean;
  readonly onToggle: (id: string) => void;
};

export const LeadTreeFoldRow = memo(({ id, depth, label, isOpen, isActive, onToggle }: Props) => {
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
        'flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-hover',
        isActive && LEAD_TREE_CURSOR,
      )}
      style={leadTreeIndentOf({ depth })}
      onClick={() => onToggle(id)}
    >
      <Chevron size={ICON_SIZE.row} className="shrink-0 text-faint-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-ui text-foreground">{label}</span>
      <span className="shrink-0 text-meta text-muted-foreground">
        {isOpen ? 'done' : 'done · folded'}
      </span>
    </div>
  );
});

LeadTreeFoldRow.displayName = 'LeadTreeFoldRow';
