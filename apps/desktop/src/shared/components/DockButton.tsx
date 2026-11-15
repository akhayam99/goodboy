import { PanelRight } from 'lucide-react';
import { Button, ICON_SIZE, Tooltip } from '@goodboy/ui';
import { NAMES } from '../utils/names';

type Props = {
  readonly tooltip: string;
  readonly onDock: () => void;
};

export const DockButton = ({ tooltip, onDock }: Props) => (
  <Tooltip content={tooltip} side="top">
    <Button variant="ghost" size="sm" onClick={onDock}>
      <PanelRight size={ICON_SIZE.control} aria-hidden />
      {NAMES.dock}
    </Button>
  </Tooltip>
);
