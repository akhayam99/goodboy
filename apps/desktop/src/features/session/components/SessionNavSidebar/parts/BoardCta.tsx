import { Kanban } from 'lucide-react';
import { KbdPill, cn, tintClasses } from '@goodboy/ui';
import { PANE_RHYTHM } from '../../../../../shared/components/paneRhythm';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';

type Props = {
  readonly onNavigate: () => void;
};

export const BoardCta = ({ onNavigate }: Props) => {
  const primaryTint = tintClasses('primary');
  const shortcut = shortcutGlyphs('session.board');
  const label = `Back to board (${shortcut})`;
  return (
    <button
      type="button"
      onClick={onNavigate}
      aria-label={label}
      title={label}
      className={cn(
        'group relative flex w-full items-center justify-center gap-2 rounded-md text-center text-sm font-medium',
        PANE_RHYTHM.navRail.row,
        'ring-1 motion-safe:transition-colors',
        primaryTint.bg,
        primaryTint.text,
        primaryTint.ring,
        primaryTint.hoverBg,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
      )}
    >
      <Kanban size={14} aria-hidden />
      Board
      <KbdPill
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-4 min-w-4 -translate-y-1/2 px-1 text-3xs opacity-0 transition-opacity group-hover:opacity-100"
      >
        {shortcut}
      </KbdPill>
    </button>
  );
};
