import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly scopeSessionId: SessionId | null;
};

export const useIsScopeLoaded = ({ scopeSessionId }: Params): boolean =>
  useAppStore(
    (state) =>
      scopeSessionId === null ||
      (state.sessionPhaseRuns[scopeSessionId] !== undefined &&
        state.sessionWorkflows[scopeSessionId] !== undefined),
  );
