import { claimsWithout } from './claimsWithout';
import type { SliceDeps } from '../../../slice-types';
import type { PushFixOutcome } from '../types';

type Params = {
  readonly mountId: PushFixOutcome['mountId'];
  readonly agentId: PushFixOutcome['agentId'];
};

export const releasePushFixClaim = ({ set }: SliceDeps) => {
  return ({ mountId, agentId }: Params): void => {
    set((state) => ({
      pushFixClaims: claimsWithout({ claims: state.pushFixClaims, mountId, agentId }),
    }));
  };
};
