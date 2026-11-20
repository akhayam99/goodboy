import type { MountId, SessionId } from '@goodboy/types';
import { settleMountCleanupProposals } from '../project-mounts/settleMountProposals';
import type { SetFn } from './types';

type FactoryParams = {
  readonly set: SetFn;
};

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly outcome: 'removed' | 'kept';
};

export const settleMountCleanup = ({ set }: FactoryParams) => {
  return async ({ sessionId, mountId, outcome }: Params): Promise<void> => {
    await settleMountCleanupProposals({ set, sessionId, mountId, outcome });
  };
};
