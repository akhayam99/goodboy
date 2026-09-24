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

const inFlight = new Map<string, Promise<void>>();

export const resolveClusterCompletionHold = ({
  set,
  get,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
}) => {
  return async ({ sessionId, holdId, resolutionEvidence }: Params): Promise<void> => {
    const pending = inFlight.get(holdId);
    if (pending !== undefined) {
      return pending;
    }
    const hold = (get().clusterCompletionHolds[sessionId] ?? []).find(
      (candidate) => candidate.id === holdId && candidate.state === 'open',
    );
    if (hold === undefined || resolutionEvidence.trim().length === 0) {
      return;
    }
    const resolution = (async (): Promise<void> => {
      await get().advanceClusterImplementation(sessionId, hold.sourceAgentId, '', {
        force: true,
        resolvedHoldId: holdId,
      });
      await invokeClusterCompletionHoldResolve({ id: holdId, resolutionEvidence });
      const holds = await invokeClusterCompletionHolds({ sessionId });
      set((state) => ({
        clusterCompletionHolds: { ...state.clusterCompletionHolds, [sessionId]: holds },
      }));
    })().finally(() => {
      if (inFlight.get(holdId) === resolution) {
        inFlight.delete(holdId);
      }
    });
    inFlight.set(holdId, resolution);
    return resolution;
  };
};
