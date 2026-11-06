import type { ProviderId } from '@goodboy/types';
import type { useTurnDispatch } from '../hooks/useTurnDispatch';
import { ComposerErrorNotice } from './ComposerErrorNotice';

type Props = {
  readonly dispatch: ReturnType<typeof useTurnDispatch>;
  readonly providerId: ProviderId;
};

export const ComposerDispatchError = ({ dispatch, providerId }: Props) => {
  if (dispatch.error === null) {
    return null;
  }
  return <ComposerErrorNotice message={dispatch.error} providerId={providerId} />;
};
