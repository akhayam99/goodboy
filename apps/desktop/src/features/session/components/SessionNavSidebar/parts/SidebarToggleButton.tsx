import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { IconButton } from '@goodboy/ui';

type Props = {
  readonly isCollapsed: boolean;
  readonly onToggle: () => void;
};

export const SidebarToggleButton = ({ isCollapsed, onToggle }: Props) => {
  const label = `${isCollapsed ? 'Show' : 'Hide'} sessions`;
  const Icon = isCollapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <IconButton
      icon={Icon}
      label={label}
      shortcut="column.toggle"
      tooltipSide="right"
      size="md"
      onClick={onToggle}
      aria-pressed={!isCollapsed}
      data-sidebar-toggle=""
    />
  );
};
