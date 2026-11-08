import { Button } from '@goodboy/ui';
import type { useArtifactRowModel } from './useArtifactRowModel';

type Props = {
  readonly model: ReturnType<typeof useArtifactRowModel>;
};

export const ArtifactRowActions = ({ model }: Props) => {
  const { controls, restoreAction, primary, isFilled } = model;
  return (
    <>
      {restoreAction === null ? null : (
        <Button
          size="sm"
          variant="secondary"
          isBusy={controls.pendingId === restoreAction.id}
          onClick={() => controls.trigger({ actionId: restoreAction.id })}
        >
          Restore
        </Button>
      )}
      {primary === null ? null : (
        <Button
          size="sm"
          variant="secondary"
          disabled={primary.blockedReason !== null}
          isBusy={controls.pendingId === primary.id}
          title={primary.blockedReason ?? primary.description ?? undefined}
          data-filled={isFilled ? 'true' : 'false'}
          onClick={() => controls.trigger({ actionId: primary.id })}
        >
          {primary.shortLabel}
        </Button>
      )}
    </>
  );
};
