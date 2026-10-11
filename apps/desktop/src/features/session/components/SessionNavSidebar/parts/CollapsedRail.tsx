import { Plus } from 'lucide-react';
import { COLLAPSED_RAIL_WIDTH, IconButton } from '@goodboy/ui';
import { SidebarToggleButton } from './SidebarToggleButton';

type Props = {
  readonly onToggleSidebar?: () => void;
  readonly isDraftShown?: boolean;
};

export const CollapsedRail = ({ onToggleSidebar, isDraftShown = false }: Props) => (
  <div
    className="flex h-full min-w-0 shrink-0 flex-col items-center gap-1 py-2"
    style={{ width: COLLAPSED_RAIL_WIDTH }}
  >
    {onToggleSidebar !== undefined ? (
      <SidebarToggleButton isCollapsed onToggle={onToggleSidebar} />
    ) : null}
    <IconButton
      icon={Plus}
      label="New session"
      shortcut="session.new"
      tooltipSide="right"
      size="md"
      onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
      aria-pressed={isDraftShown}
      className={isDraftShown ? 'bg-selected text-foreground' : undefined}
    />
  </div>
);
