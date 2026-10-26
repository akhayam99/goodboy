import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';

type Deps = Pick<SliceDeps, 'set'>;

type ClearParams = {
  readonly sessionId: SessionId;
};

export const clearTerminalFinished = ({ set }: Deps) => {
  return ({ sessionId }: ClearParams): void => {
    set((state) => {
      if (state.terminalFinishes[sessionId] === undefined) {
        return state;
      }
      return {
        terminalFinishes: Object.fromEntries(
          Object.entries(state.terminalFinishes).filter(([id]) => id !== sessionId),
        ),
      };
    });
  };
};
