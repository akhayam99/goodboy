import { memo } from 'react';
import { MessageSquare } from '@goodboy/ui/icons';
import { Button, cn, ICON_SIZE } from '@goodboy/ui';
import { LeadTreeGuide } from './LeadTreeGuide';
import type { LeadTreeGuide as Guide } from './leadTreeGuidesOf';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly text: string;
  readonly word: string;
  readonly canEdit: boolean;
  readonly canRemove: boolean;
  readonly isActive: boolean;
  readonly guide: Guide;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
};

export const LeadTreeNoteRow = memo(
  ({ id, text, word, canEdit, canRemove, isActive, guide, onEdit, onRemove }: Props) => (
    <div
      role="treeitem"
      tabIndex={-1}
      aria-label={`Your note, ${text}, ${word}`}
      data-lead-tree-id={id}
      data-lead-tree-note=""
      data-active={isActive}
      className={cn(LEAD_TREE_ROW, isActive && LEAD_TREE_CURSOR)}
    >
      <LeadTreeGuide
        guide={guide}
        marker={
          <span className="flex size-4 items-center justify-center rounded-full bg-background text-faint-foreground">
            <MessageSquare size={ICON_SIZE.mark} aria-hidden="true" />
          </span>
        }
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
