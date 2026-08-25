import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly sessionId: SessionId;
};

export const useSessionProjectScope = ({ sessionId }: Params): ProjectId | undefined =>
  useAppStore((state) => {
    const storedProjectId = state.sessionActiveProject[sessionId];
    if (storedProjectId != null) {
      return storedProjectId;
    }
    return state.sessions.find((session) => session.id === sessionId)?.activeProjectId ?? undefined;
  });
