import { createPortal } from 'react-dom';
import { GripVertical } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import { quoted } from '../../historyEditText';
import type { HistoryDragState } from '../../useHistoryDrag';

type Props = {
  readonly drag: HistoryDragState;
  readonly title: string;
  readonly titleOf: (sha: string) => string;
};

const GHOST_MAX_WIDTH = 460;

export const HistoryDragGhost = ({ drag, title, titleOf }: Props) => {
  const target = drag.target;
  const label =
    target === null
      ? 'Drop between two commits, or onto one'
      : target.mode === 'noop'
        ? 'Already here'
        : target.mode === 'into'
          ? `Fold into ${quoted({ text: titleOf(target.sha) })}, keeps its title`
          : 'Move here';
  const action =
    target === null || target.mode === 'noop' ? null : target.mode === 'into' ? 'fixup' : 'move';
  return createPortal(
    <div
      aria-hidden
      data-history-ghost
      style={{
        left: drag.x - drag.offsetX,
        top: drag.y - drag.offsetY,
        width: Math.min(drag.width, GHOST_MAX_WIDTH),
      }}
      className="pointer-events-none fixed z-drag flex items-center gap-2.5 rounded-lg border border-border bg-floating px-2.5 py-2 shadow-md"
    >
      <GripVertical
        size={ICON_SIZE.control}
        aria-hidden
        className="shrink-0 text-faint-foreground"
      />
      <span className="min-w-0 flex-1 truncate text-row text-foreground">{title}</span>
      <span
        className={cn(
          'shrink-0 rounded-sm px-1.5 text-secondary',
          action === null
            ? 'bg-fill text-muted-foreground'
            : cn(HISTORY_ACTION_CLASSES[action].solid, 'text-on-tone'),
        )}
      >
        {label}
      </span>
    </div>,
    document.body,
  );
};
