import { useEffect, useMemo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { blockedQuestionOf, type BlockedQuestion } from '../../../workflows/blockedQuestionOf';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const useBlockedQuestion = ({ sessionId, agentId }: Params): BlockedQuestion | null => {
  const events = useAppStore((state) => state.transcripts[agentId]);
  const loadAgentTranscript = useAppStore((state) => state.loadAgentTranscript);
  const reportError = useAppStore((state) => state.reportError);
  const isLoaded = events !== undefined;
  useEffect(() => {
    if (isLoaded) {
      return;
    }
    void loadAgentTranscript(sessionId, agentId, { isSelecting: false }).catch((error: unknown) => {
      if (!isReportedError(error)) {
        void reportError({ title: "Couldn't read what the step asked", error, sessionId });
      }
    });
  }, [isLoaded, loadAgentTranscript, reportError, sessionId, agentId]);
  return useMemo(() => (events === undefined ? null : blockedQuestionOf({ events })), [events]);
};
