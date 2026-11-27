import { memo } from 'react';
import { ICON_SIZE, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { LEAD_TREE_UNIT, LeadTreeGuides } from './LeadTreeGuides';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly artifactId: string;
  readonly label: string;
  readonly isActive: boolean;
  readonly depth: number;
  readonly onOpen: (artifactId: string) => void;
};

export const LeadTreeMarkRow = memo(({ id, artifactId, label, isActive, depth, onOpen }: Props) => {
  const Icon = CONCEPT_ICONS.artifacts;
  return (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-label={label}
      data-lead-tree-id={id}
      data-lead-tree-mark=""
      data-active={isActive}
      className={cn(
        LEAD_TREE_ROW,
        'cursor-pointer text-meta text-muted-foreground hover:bg-hover',
        isActive && LEAD_TREE_CURSOR,
      )}
      onClick={() => onOpen(artifactId)}
    >
      <LeadTreeGuides depth={depth} />
      <span aria-hidden className="shrink-0" style={{ width: depth * LEAD_TREE_UNIT }} />
      <Icon size={ICON_SIZE.row} aria-hidden="true" className="shrink-0 text-faint-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </div>
  );
});

LeadTreeMarkRow.displayName = 'LeadTreeMarkRow';
