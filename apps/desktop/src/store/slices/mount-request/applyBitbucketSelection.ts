import type { MountId, MountPullRequestIdentity, SessionId } from '@goodboy/types';
import {
  applyMountRequest,
  type MountRequestProjectionState,
  type MountRequestWrite,
} from './applyMountRequest';
import { bitbucketMountOf } from './requestOf';
import type { MountBitbucketPrState } from './state';

type Params = {
  readonly state: MountRequestProjectionState;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly selected: MountPullRequestIdentity | null;
  readonly fallback?: MountBitbucketPrState;
};

export const applyBitbucketSelection = ({
  state,
  sessionId,
  mountId,
  selected,
  fallback,
}: Params): MountRequestWrite | Record<string, never> => {
  const entry = bitbucketMountOf({ state, mountId }) ?? fallback;
  if (entry === undefined) {
    return {};
  }
  return applyMountRequest({
    state,
    sessionId,
    mountId,
    request: { ...entry, selected },
  });
};
