import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Params = {
  readonly sessionId: SessionId;
};

export const useSessionProjectScope = ({ sessionId }: Params): ProjectId | undefined =>
  useAppStore((state) => {
    const storedProjectId = state.sessionActiveProject[sessionId];
    if (storedProjectId != null) {
      return storedProjectId;
    }
    return sessionById(state.sessions, sessionId)?.activeProjectId ?? undefined;
  });
