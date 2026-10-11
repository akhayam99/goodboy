import { Button, FormActions } from '@goodboy/ui';
import type { ResolveLaunchMode } from '@goodboy/types';
import { FIX_COMMENTS_LABEL, startFixLabel } from './fixCommentsCopy';

type Props = {
  readonly count: number;
  readonly startedMode: ResolveLaunchMode | null;
  readonly error: string | null;
  readonly onStart: (mode: ResolveLaunchMode) => void;
};

export const FixCommentsLaunchRow = ({ count, startedMode, error, onStart }: Props) => {
  const isStarting = startedMode !== null;
  return (
    <FormActions error={error} reason={count === 0 ? FIX_COMMENTS_LABEL.nothingSelected : null}>
      <Button
        size="sm"
        variant="ghost"
        isBusy={startedMode === 'propose'}
        disabled={count === 0 || isStarting}
        onClick={() => onStart('propose')}
      >
        {FIX_COMMENTS_LABEL.analyze}
      </Button>
      <Button
        size="sm"
        variant="primary"
        isBusy={startedMode === 'apply'}
        disabled={count === 0 || isStarting}
        onClick={() => onStart('apply')}
      >
        {startFixLabel({ count })}
      </Button>
    </FormActions>
  );
};
