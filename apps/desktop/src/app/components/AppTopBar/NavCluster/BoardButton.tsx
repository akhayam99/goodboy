import { SquareKanban } from 'lucide-react';
import { Tooltip, cn } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly isOnBoard: boolean;
  readonly hasStudio: boolean;
  readonly onBoard: () => void;
};

export const BoardButton = ({ isOnBoard, hasStudio, onBoard }: Props) => {
  const isCurrent = isOnBoard && !hasStudio;
  const glyph = shortcutGlyphs('session.board');

  return (
    <Tooltip content={`Board  ${glyph}`} side="bottom">
      <button
        type="button"
        aria-current={isCurrent ? 'page' : undefined}
        aria-disabled={isCurrent ? true : undefined}
        data-nav-board=""
        onClick={() => {
          if (isCurrent) {
            return;
          }
          onBoard();
        }}
        className={cn(
          'flex h-6 shrink-0 items-center gap-2 rounded-md px-2 text-label motion-safe:transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          isCurrent
            ? 'cursor-default bg-overlay-selected text-foreground'
            : 'text-muted-foreground hover:bg-hover hover:text-foreground',
        )}
      >
        <SquareKanban size={ICON_SIZE.control} aria-hidden />
        Board
      </button>
    </Tooltip>
  );
};
