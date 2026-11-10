import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { INNER_COLUMN_SHORTCUT, IconButton } from '@goodboy/ui';

type Props = {
  readonly isFolded: boolean;
  readonly onToggle: () => void;
};

export const SessionRailToggle = ({ isFolded, onToggle }: Props) => (
  <IconButton
    icon={isFolded ? PanelLeftOpen : PanelLeftClose}
    label={isFolded ? 'Show session pages' : 'Hide session pages'}
    shortcut={INNER_COLUMN_SHORTCUT}
    tooltipSide="right"
    size="md"
    onClick={onToggle}
    aria-pressed={!isFolded}
    data-session-rail-toggle=""
  />
);
