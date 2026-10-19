import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { ActionMenuBehavior, SuggestionActionTarget } from './types';

type Props = ActionMenuBehavior & {
  readonly target: SuggestionActionTarget;
  readonly label: string;
  readonly isDisabled: boolean;
  readonly minEntries?: number;
};

export const SuggestionOverflowMenu = ({
  target,
  label,
  isDisabled,
  minEntries,
  onPreview,
  track,
  isHeld,
}: Props) => (
  <ObjectOverflowMenu
    hideWhenEmpty
    minEntries={minEntries}
    size="control"
    target={target}
    label={label}
    disabled={isDisabled}
    onPreview={onPreview}
    track={track}
    isHeld={isHeld}
  />
);
