import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';

type Deps = Pick<SliceDeps, 'set'>;

type Params = {
  readonly sessionId: SessionId;
  readonly scriptKey: string;
  readonly runId: string;
};

export const markScriptRunSeen = ({ set }: Deps) => {
  return ({ sessionId, scriptKey, runId }: Params): void => {
    set((state) => {
      if (state.scriptRunsSeen[sessionId]?.[scriptKey] === runId) {
        return state;
      }
      return {
        scriptRunsSeen: {
          ...state.scriptRunsSeen,
          [sessionId]: { ...state.scriptRunsSeen[sessionId], [scriptKey]: runId },
        },
      };
    });
  };
};
