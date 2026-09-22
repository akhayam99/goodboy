import type { SessionId } from '@goodboy/types';
import {
  invokeClusterCompletionHoldResolve,
  invokeClusterCompletionHolds,
} from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly holdId: string;
  readonly resolutionEvidence: string;
};

export const resolveClusterCompletionHold = ({
  set,
  get,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
}) => {
  return async ({ sessionId, holdId, resolutionEvidence }: Params): Promise<void> => {
    const hold = (get().clusterCompletionHolds[sessionId] ?? []).find(
      (candidate) => candidate.id === holdId && candidate.state === 'open',
    );
    if (hold === undefined || resolutionEvidence.trim().length === 0) {
      return;
    }
    await invokeClusterCompletionHoldResolve({ id: holdId, resolutionEvidence });
    const holds = await invokeClusterCompletionHolds({ sessionId });
    set((state) => ({
      clusterCompletionHolds: { ...state.clusterCompletionHolds, [sessionId]: holds },
    }));
    await get().advanceClusterImplementation(sessionId, hold.sourceAgentId, '', {
      force: true,
      resolvedHoldId: holdId,
    });
  };
};
