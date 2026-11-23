import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { isFaceShown } from '../isFaceShown';

type Params = {
  readonly sessionId: SessionId;
};

export const useIsDeskShown = ({ sessionId }: Params): boolean =>
  useAppStore(
    (state) =>
      (state.selectedAgentId[sessionId] ?? null) === null && isFaceShown({ state, sessionId }),
  );
