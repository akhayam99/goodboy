import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly sessionId: SessionId;
};

export const useIsSessionSyncing = ({ sessionId }: Params): boolean =>
  useAppStore((state) => state.sessionSyncing[sessionId] === true);
