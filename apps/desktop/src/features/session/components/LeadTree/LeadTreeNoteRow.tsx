import { memo } from 'react';
import { MessageSquare } from '@goodboy/ui/icons';
import { ActivityMessage, Button, ICON_SIZE, WorkNode, cn } from '@goodboy/ui';
import { SpawnedRailCell } from '../SessionWorkspace/parts/TimelinePane/SpawnedRailCell';
import type { RailInk, RailRow } from '../../../workTreeModel/railGeometry';
import { LEAD_TREE_CURSOR } from './leadTreeCursor';
import { LEAD_TREE_ROW } from './leadTreeRow';

type Props = {
  readonly id: string;
  readonly text: string;
  readonly word: string;
  readonly canEdit: boolean;
  readonly canRemove: boolean;
  readonly isActive: boolean;
  readonly isCompact: boolean;
  readonly rail: RailRow;
  readonly tail: ReadonlyArray<RailInk>;
  readonly railWidth: number;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
};

const MESSAGE_NODE = (
  <WorkNode
    look="quiet"
    size="sm"
    state="marker"
    label="Your note"
    mark={{
      kind: 'glyph',
      glyph: <MessageSquare size={ICON_SIZE.mark} className="text-muted-foreground" />,
    }}
  />
);

export const LeadTreeNoteRow = memo(
  ({
    id,
    text,
    word,
    canEdit,
    canRemove,
    isActive,
    isCompact,
    rail,
    tail,
    railWidth,
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
      className={cn(LEAD_TREE_ROW, isActive && LEAD_TREE_CURSOR)}
    >
      <SpawnedRailCell rail={rail} tail={tail} width={railWidth} marker={MESSAGE_NODE} />
      <ActivityMessage
        density="rail"
        text={text}
        byline={`You · ${word.charAt(0).toLowerCase()}${word.slice(1)}`}
        isPending={canEdit || canRemove}
        alignWith={isCompact ? null : 'narrow'}
        actions={
          <>
            {canEdit ? (
              <Button variant="ghost" size="xs" onClick={() => onEdit(id)}>
                Edit
              </Button>
            ) : null}
            {canRemove ? (
              <Button variant="ghost" size="xs" onClick={() => onRemove(id)}>
                Remove
              </Button>
            ) : null}
          </>
        }
      />
    </div>
  ),
);

LeadTreeNoteRow.displayName = 'LeadTreeNoteRow';
