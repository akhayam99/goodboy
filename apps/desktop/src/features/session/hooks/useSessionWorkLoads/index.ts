import { READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { useEffect, useState } from 'react';
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
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);
  const loadSessionAnsweredQuestions = useAppStore((s) => s.loadSessionAnsweredQuestions);
  const loadSessionDismissedQuestions = useAppStore((s) => s.loadSessionDismissedQuestions);
  const flagUndeliveredAnswers = useAppStore((s) => s.flagUndeliveredAnswers);
  const reportError = useAppStore((s) => s.reportError);
  const hasAgents = useAppStore((s) => s.sessionPhaseRuns[sessionId] !== undefined);
  const [questionsReadFor, setQuestionsReadFor] = useState<SessionId | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const count = mountsBySession.get(sessionId) ?? 0;
    mountsBySession.set(sessionId, count + 1);
    if (count === 0) {
      void loadSessionEvents({ sessionId });
      void loadSessionArtifacts(sessionId);
      loadSessionContextItems({ sessionId }).catch((error: unknown) => {
        void reportError({
          recovery: READ_FAILED,
          title: "Couldn't load the session notes",
          error,
          sessionId,
        });
      });
      const isOpenLoaded = useAppStore.getState().sessionOpenQuestions[sessionId] !== undefined;
      void Promise.all([
        isOpenLoaded ? undefined : loadSessionOpenQuestions(sessionId),
        loadSessionAnsweredQuestions(sessionId),
      ]).then(() => {
        if (isCurrent) {
          setQuestionsReadFor(sessionId);
        }
      });
      void loadSessionDismissedQuestions(sessionId);
    }
    return () => {
      isCurrent = false;
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
    loadSessionOpenQuestions,
    reportError,
    sessionId,
  ]);

  useEffect(() => {
    if (hasAgents && questionsReadFor === sessionId) {
      flagUndeliveredAnswers({ sessionId });
    }
  }, [flagUndeliveredAnswers, hasAgents, questionsReadFor, sessionId]);
};
