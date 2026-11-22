import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly hasLedger: boolean;
};

export const useContextLoads = ({ sessionId, hasLedger }: Params) => {
  const ensureSessionSlots = useAppStore((state) => state.ensureSessionSlots);
  const loadSessionDecisions = useAppStore((state) => state.loadSessionDecisions);
  const loadSessionOpenQuestions = useAppStore((state) => state.loadSessionOpenQuestions);
  const loadSessionContextSeen = useAppStore((state) => state.loadSessionContextSeen);
  const loadSessionContextItems = useAppStore((state) => state.loadSessionContextItems);

  useEffect(() => {
    void ensureSessionSlots(sessionId);
    void loadSessionOpenQuestions(sessionId);
    void loadSessionContextSeen(sessionId);
    void loadSessionContextItems({ sessionId });
  }, [
    ensureSessionSlots,
    loadSessionContextItems,
    loadSessionContextSeen,
    loadSessionOpenQuestions,
    sessionId,
  ]);

  useEffect(() => {
    if (hasLedger) {
      return;
    }
    void loadSessionDecisions(sessionId);
  }, [hasLedger, loadSessionDecisions, sessionId]);
};
