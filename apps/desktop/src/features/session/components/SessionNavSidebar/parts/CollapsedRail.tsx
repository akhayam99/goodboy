import { Plus } from 'lucide-react';
import { COLLAPSED_RAIL_WIDTH, Tooltip, cn } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { SidebarToggleButton } from './SidebarToggleButton';

const RAIL_BUTTON = cn(
  'flex size-8 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
  'text-muted-foreground hover:bg-hover hover:text-foreground',
);

type Props = {
  readonly onToggleSidebar?: () => void;
};

export const CollapsedRail = ({ onToggleSidebar }: Props) => (
  <div
    className="flex h-full min-w-0 shrink-0 flex-col items-center gap-1 py-2"
    style={{ width: COLLAPSED_RAIL_WIDTH }}
  >
    {onToggleSidebar !== undefined ? (
      <SidebarToggleButton isCollapsed onToggle={onToggleSidebar} />
    ) : null}
    <Tooltip content={`New session (${shortcutGlyphs('session.new')})`} side="right">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
        aria-label={`New session (${shortcutGlyphs('session.new')})`}
        className={RAIL_BUTTON}
      >
        <Plus size={ICON_SIZE.control} aria-hidden />
      </button>
    </Tooltip>
  </div>
);
