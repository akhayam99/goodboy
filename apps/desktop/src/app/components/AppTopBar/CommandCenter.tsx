import { Search } from 'lucide-react';
import { Kbd } from '@goodboy/ui';
import { useCurrentWorkspace } from '../../../store';
import { OPEN_COMMAND_PALETTE_EVENT } from '../../../features/onboarding/openCommandPaletteEvent';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

export const CommandCenter = () => {
  const workspace = useCurrentWorkspace();
  const glyph = shortcutGlyphs('palette.open');
  const place = workspace?.name ?? 'Goodboy';
  const label = `Search or ask in ${place} (${glyph})`;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))}
      aria-label={label}
      title={label}
      className="flex h-6 min-w-0 items-center gap-1 rounded-md border border-border-soft bg-subtle px-2 text-chip text-faint-foreground motion-safe:transition-colors hover:border-border hover:text-muted-foreground @min-chrome-labels/topbar:w-50 @min-chrome-wide/topbar:w-70"
    >
      <Search size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="hidden min-w-0 flex-1 truncate text-left @min-chrome-labels/topbar:inline">
        Search or ask
        <span className="hidden @min-chrome-wide/topbar:inline"> in {place}</span>
      </span>
      <Kbd look="inline" aria-hidden className="shrink-0">
        {glyph}
      </Kbd>
    </button>
  );
};
