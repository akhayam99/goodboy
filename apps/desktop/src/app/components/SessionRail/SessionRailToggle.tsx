import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { IconButton } from '@goodboy/ui';

type Props = {
  readonly isFolded: boolean;
  readonly onToggle: () => void;
};

export const SessionRailToggle = ({ isFolded, onToggle }: Props) => (
  <IconButton
    icon={isFolded ? PanelLeftOpen : PanelLeftClose}
    label={isFolded ? 'Show session rail' : 'Fold session rail'}
    tooltipSide="right"
    size="md"
    onClick={onToggle}
    aria-pressed={!isFolded}
    data-session-rail-toggle=""
  />
);
