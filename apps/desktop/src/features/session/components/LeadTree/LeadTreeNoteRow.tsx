import { memo } from 'react';
import { MessageSquare } from '@goodboy/ui/icons';
import { Button, cn, ICON_SIZE } from '@goodboy/ui';
import { LEAD_TREE_UNIT, LeadTreeGuides } from './LeadTreeGuides';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly text: string;
  readonly word: string;
  readonly canEdit: boolean;
  readonly canRemove: boolean;
  readonly isActive: boolean;
  readonly depth: number;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
};

export const LeadTreeNoteRow = memo(
  ({ id, text, word, canEdit, canRemove, isActive, depth, onEdit, onRemove }: Props) => (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-label={`Your note, ${text}, ${word}`}
      data-lead-tree-id={id}
      data-lead-tree-note=""
      data-active={isActive}
      className={cn(LEAD_TREE_ROW, isActive && LEAD_TREE_CURSOR)}
    >
      <LeadTreeGuides depth={depth} />
      <span aria-hidden className="shrink-0" style={{ width: depth * LEAD_TREE_UNIT }} />
      <span className="flex size-4 shrink-0 items-center justify-center text-faint-foreground">
        <MessageSquare size={ICON_SIZE.row} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-ui text-foreground">{text}</span>
      {canEdit ? (
        <Button variant="ghost" size="xs" className="shrink-0" onClick={() => onEdit(id)}>
          Edit
        </Button>
      ) : null}
      {canRemove ? (
        <Button variant="ghost" size="xs" className="shrink-0" onClick={() => onRemove(id)}>
          Remove
        </Button>
      ) : null}
      <span className="shrink-0 text-meta text-muted-foreground">{word}</span>
    </div>
  ),
);

LeadTreeNoteRow.displayName = 'LeadTreeNoteRow';
