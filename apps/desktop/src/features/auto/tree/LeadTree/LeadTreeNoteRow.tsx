import { memo } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button, cn, ICON_SIZE } from '@goodboy/ui';
import { leadTreeIndentOf } from './leadTreeIndentOf';

type Props = {
  readonly id: string;
  readonly depth: number;
  readonly text: string;
  readonly word: string;
  readonly canEdit: boolean;
  readonly canRemove: boolean;
  readonly isActive: boolean;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
};

export const LeadTreeNoteRow = memo(
  ({ id, depth, text, word, canEdit, canRemove, isActive, onEdit, onRemove }: Props) => (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-label={`Your note, ${text}, ${word}`}
      data-lead-tree-id={id}
      data-lead-tree-note=""
      data-active={isActive}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md px-2 py-1',
        isActive && 'ring-1 ring-focus-ring',
      )}
      style={leadTreeIndentOf({ depth })}
    >
      <MessageSquare
        size={ICON_SIZE.row}
        className="shrink-0 text-faint-foreground"
        aria-hidden="true"
      />
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
