import { IconButton } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { GoalPresence } from './goalPresence';

type Props = {
  readonly presence: Exclude<GoalPresence, 'own'>;
  readonly disabled: boolean;
  readonly onClick: () => void;
};

export const GoalDetailAction = ({ presence, disabled, onClick }: Props) => {
  const label = presence === 'title' ? 'Detail the goal' : 'Add a goal';
  return (
    <IconButton
      variant="ghost"
      icon={CONCEPT_ICONS.goal}
      iconSize={ICON_SIZE.row}
      label={label}
      tooltip={presence === 'title' ? 'The title is the whole goal so far. Detail it' : label}
      disabled={disabled}
      onClick={onClick}
      className="size-6 shrink-0"
    />
  );
};
