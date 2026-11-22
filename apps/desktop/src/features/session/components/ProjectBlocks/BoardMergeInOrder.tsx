import { Button } from '@goodboy/ui';
import { useBoardContext } from './useBoardContext';

export const BoardMergeInOrder = () => {
  const { mergeCard, actionsFor } = useBoardContext();
  if (mergeCard === null) {
    return null;
  }
  const { main } = actionsFor({ card: mergeCard });
  if (main === null) {
    return null;
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={main.isDisabled}
      isBusy={main.isBusy}
      onClick={main.run}
    >
      {main.label}
    </Button>
  );
};
