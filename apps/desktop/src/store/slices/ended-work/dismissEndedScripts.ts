import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly sessionId: SessionId;
};

export const dismissEndedScripts = ({ set }: Pick<SliceDeps, 'set'>) => {
  return ({ sessionId }: Params): void => {
    set((state) => {
      if (state.endedWork === null) {
        return {};
      }
      return {
        endedWork: {
          ...state.endedWork,
          scripts: state.endedWork.scripts.filter((script) => script.sessionId !== sessionId),
        },
      };
    });
  };
};
