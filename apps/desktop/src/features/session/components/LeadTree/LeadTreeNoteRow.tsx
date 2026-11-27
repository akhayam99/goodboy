import { memo } from 'react';
import { Button, Tooltip, cn } from '@goodboy/ui';
import { LEAD_TREE_UNIT, LeadTreeGuides } from './LeadTreeGuides';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_NOTE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly text: string;
  readonly word: string;
  readonly isRead: boolean;
  readonly canEdit: boolean;
  readonly canRemove: boolean;
  readonly isActive: boolean;
  readonly depth: number;
  readonly onOpen: () => void;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
};

export const LeadTreeNoteRow = memo(
  ({
    id,
    text,
    word,
    isRead,
    canEdit,
    canRemove,
    isActive,
    depth,
    onOpen,
    onEdit,
    onRemove,
  }: Props) => (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-label={`Your note, ${text}, ${word}`}
      data-lead-tree-id={id}
      data-lead-tree-note=""
      data-active={isActive}
      className={cn(
        LEAD_TREE_NOTE_ROW,
        'cursor-pointer hover:bg-hover',
        isActive && LEAD_TREE_CURSOR,
      )}
      onClick={onOpen}
    >
      <LeadTreeGuides depth={depth} />
      <span aria-hidden className="shrink-0" style={{ width: depth * LEAD_TREE_UNIT }} />
      <Tooltip content={word} anchorClassName="flex min-w-0 flex-1">
        <span
          data-lead-tree-note-text=""
          className="line-clamp-2 min-w-0 flex-1 text-meta text-faint-foreground"
        >
          {text}
        </span>
      </Tooltip>
      {isRead ? null : (
        <span data-lead-tree-note-word="" className="shrink-0 text-meta text-faint-foreground">
          {word}
        </span>
      )}
      {canEdit ? (
        <Button
          variant="ghost"
          size="xs"
          className="shrink-0"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(id);
          }}
        >
          Edit
        </Button>
      ) : null}
      {canRemove ? (
        <Button
          variant="ghost"
          size="xs"
          className="shrink-0"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(id);
          }}
        >
          Remove
        </Button>
      ) : null}
    </div>
  ),
);

LeadTreeNoteRow.displayName = 'LeadTreeNoteRow';
