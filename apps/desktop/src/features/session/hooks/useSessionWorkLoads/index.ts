import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const mountsBySession = new Map<SessionId, number>();

type Params = {
  readonly sessionId: SessionId;
};

export const useSessionWorkLoads = ({ sessionId }: Params): void => {
  const loadSessionEvents = useAppStore((s) => s.loadSessionEvents);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const loadSessionContextItems = useAppStore((s) => s.loadSessionContextItems);
  const loadSessionAnsweredQuestions = useAppStore((s) => s.loadSessionAnsweredQuestions);
  const loadSessionDismissedQuestions = useAppStore((s) => s.loadSessionDismissedQuestions);
  const reportError = useAppStore((s) => s.reportError);

  useEffect(() => {
    const count = mountsBySession.get(sessionId) ?? 0;
    mountsBySession.set(sessionId, count + 1);
    if (count === 0) {
      void loadSessionEvents({ sessionId });
      void loadSessionArtifacts(sessionId);
      loadSessionContextItems({ sessionId }).catch((error: unknown) => {
        void reportError({ title: "Couldn't load the session notes", error, sessionId });
      });
      void loadSessionAnsweredQuestions(sessionId);
      void loadSessionDismissedQuestions(sessionId);
    }
    return () => {
      const remaining = (mountsBySession.get(sessionId) ?? 1) - 1;
      if (remaining <= 0) {
        mountsBySession.delete(sessionId);
        return;
      }
      mountsBySession.set(sessionId, remaining);
    };
  }, [
    loadSessionAnsweredQuestions,
    loadSessionArtifacts,
    loadSessionContextItems,
    loadSessionDismissedQuestions,
    loadSessionEvents,
    reportError,
    sessionId,
  ]);
};
