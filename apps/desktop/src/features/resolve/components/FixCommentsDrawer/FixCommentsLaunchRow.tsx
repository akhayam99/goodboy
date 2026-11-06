import { Button, FormActions } from '@goodboy/ui';
import { FIX_COMMENTS_LABEL, startFixLabel } from './fixCommentsCopy';
import type { FixLaunch } from './useFixLaunch';

type Props = {
  readonly count: number;
  readonly launch: FixLaunch;
};

export const FixCommentsLaunchRow = ({ count, launch }: Props) => {
  const { blockedReason, startedMode, error } = launch;
  const isHeld = count === 0 || startedMode !== null || blockedReason !== null;
  const reason = blockedReason ?? (count === 0 ? FIX_COMMENTS_LABEL.nothingSelected : null);
  return (
    <FormActions error={error} reason={reason}>
      <Button
        size="sm"
        variant="ghost"
        isBusy={startedMode === 'propose'}
        disabled={isHeld}
        onClick={() => void launch.start('propose')}
      >
        {FIX_COMMENTS_LABEL.analyze}
      </Button>
      <Button
        size="sm"
        variant="primary"
        data-demo-anchor="resolve-start"
        isBusy={startedMode === 'apply'}
        disabled={isHeld}
        onClick={() => void launch.start('apply')}
      >
        {startFixLabel({ count })}
      </Button>
    </FormActions>
  );
};
