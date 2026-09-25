import { PanelLeft } from 'lucide-react';
import { Tooltip, cn } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type TopBarSidebar = {
  readonly hasSidebar: boolean;
  readonly isCollapsed: boolean;
  readonly onToggle: () => void;
};

type Props = {
  readonly sidebar: TopBarSidebar;
};

const SLOT = 'flex size-7 shrink-0 items-center justify-center rounded-md';

export const SidebarToggle = ({ sidebar }: Props) => {
  if (!sidebar.hasSidebar) {
    return <span aria-hidden data-testid="sidebar-toggle-slot" className={SLOT} />;
  }
  const label = `${sidebar.isCollapsed ? 'Show' : 'Hide'} sessions (${shortcutGlyphs('column.toggle')})`;

  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        onClick={sidebar.onToggle}
        aria-label={label}
        aria-pressed={!sidebar.isCollapsed}
        className={cn(
          SLOT,
          'motion-safe:transition-colors hover:bg-hover hover:text-foreground',
          sidebar.isCollapsed ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        <PanelLeft size={ICON_SIZE.control} aria-hidden />
      </button>
    </Tooltip>
  );
};
