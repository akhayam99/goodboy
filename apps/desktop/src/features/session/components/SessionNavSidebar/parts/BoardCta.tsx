import { Kanban } from 'lucide-react';
import { KbdPill, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly onNavigate: () => void;
};

export const BoardCta = ({ onNavigate }: Props) => {
  const shortcut = shortcutGlyphs('session.board');
  const label = `Back to board (${shortcut})`;
  return (
    <button
      type="button"
      onClick={onNavigate}
      aria-label={label}
      title={label}
      className={cn(
        'group relative flex w-full items-center gap-2 rounded-md text-left text-row',
        PANE_RHYTHM.navRail.row,
        'text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
      )}
    >
      <Kanban size={ICON_SIZE.control} aria-hidden />
      Board
      <KbdPill
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-4 min-w-4 -translate-y-1/2 px-1 text-meta opacity-0 transition-opacity group-hover:opacity-100"
      >
        {shortcut}
      </KbdPill>
    </button>
  );
};
