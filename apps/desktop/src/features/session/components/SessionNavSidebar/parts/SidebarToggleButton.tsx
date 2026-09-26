import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Tooltip, cn } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly isCollapsed: boolean;
  readonly onToggle: () => void;
};

export const SidebarToggleButton = ({ isCollapsed, onToggle }: Props) => {
  const label = `${isCollapsed ? 'Show' : 'Hide'} sessions (${shortcutGlyphs('column.toggle')})`;
  const Icon = isCollapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <Tooltip content={label} side="right">
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-pressed={!isCollapsed}
        data-sidebar-toggle=""
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors',
          'hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        )}
      >
        <Icon size={ICON_SIZE.control} aria-hidden />
      </button>
    </Tooltip>
  );
};
