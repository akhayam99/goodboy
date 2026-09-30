import type { ProviderId } from '@goodboy/types';
import type { useTurnDispatch } from '../hooks/useTurnDispatch';
import { ComposerErrorNotice } from './ComposerErrorNotice';

type Props = {
  readonly dispatch: ReturnType<typeof useTurnDispatch>;
  readonly providerId: ProviderId;
};

export const ComposerDispatchError = ({ dispatch, providerId }: Props) => {
  if (!dispatch.error) {
    return null;
  }
  return (
    <ComposerErrorNotice
      message={dispatch.error}
      providerId={providerId}
      onRetry={
        dispatch.lastFailedTurn != null
          ? () => {
              const failed = dispatch.lastFailedTurn;
              if (failed == null) {
                return;
              }
              dispatch.setError(null);
              void dispatch.dispatchTurn({
                content: failed.content,
                atts: failed.attachments,
                override: failed.override,
                agentId: failed.agentId,
              });
            }
          : undefined
      }
    />
  );
};
