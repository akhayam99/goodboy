import { SearchMode } from '../SearchMode';
import type { OverlayModeProps } from '../../overlayMode';

export const SearchOverlay = ({ initialText, onSwitchMode, onClose }: OverlayModeProps) => (
  <div className="fixed inset-0 z-command-palette flex items-start justify-center px-4 pt-16">
    <div aria-hidden className="absolute inset-0 bg-scrim" onMouseDown={onClose} />
    <dialog
      open
      aria-label="Search"
      className="relative m-0 flex w-full max-w-[920px] flex-col overflow-hidden rounded-lg border border-border bg-floating p-0 text-foreground shadow-lg motion-safe:animate-studio-in"
    >
      <SearchMode initialText={initialText} onSwitchMode={onSwitchMode} onClose={onClose} />
    </dialog>
  </div>
);
