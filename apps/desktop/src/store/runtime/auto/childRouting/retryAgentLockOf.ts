import type { AutoDelegation } from '@goodboy/db';
import type { WorkflowModelPick } from '@goodboy/types';
import type { AutoContinue } from '../../../../features/auto/delegationContinueOf';
import { isTurnFailureReason } from '../../../slices/turn/turnFailure/isTurnFailureReason';
import { isStartFailure } from './isStartFailure';
import { storedPickOf } from './storedPickOf';

type Params = {
  readonly retry: AutoDelegation | null;
  readonly continueWith: AutoContinue | null;
};

export const retryAgentLockOf = ({ retry, continueWith }: Params): WorkflowModelPick | null => {
  if (retry === null || continueWith === null) {
    return null;
  }
  const reason = retry.reason ?? null;
  if (isStartFailure({ endReason: reason }) || isTurnFailureReason({ reason })) {
    return null;
  }
  return storedPickOf({ routing: retry.routing });
};
