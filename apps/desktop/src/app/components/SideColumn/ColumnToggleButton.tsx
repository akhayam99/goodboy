import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { IconButton } from '@goodboy/ui';

type Props = {
  readonly isCollapsed: boolean;
  readonly onToggle: () => void;
};

export const ColumnToggleButton = ({ isCollapsed, onToggle }: Props) => {
  const label = `${isCollapsed ? 'Show' : 'Hide'} sidebar`;
  const Icon = isCollapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <IconButton
      icon={Icon}
      label={label}
      shortcut="column.toggle"
      tooltipSide="bottom"
      size="md"
      onClick={onToggle}
      aria-pressed={!isCollapsed}
      data-sidebar-toggle=""
    />
  );
};
