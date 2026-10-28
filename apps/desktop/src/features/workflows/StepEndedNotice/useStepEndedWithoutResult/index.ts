import { useEffect } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { classifyAgent } from '../../../session/agent-kind';
import { isAgentMissingArtifact } from '../../../artifacts/turnArtifactOutcome';
import { blockedQuestionOf } from '../../blockedQuestionOf';
import { stepEndedWithoutResult } from '../../stepEndedWithoutResult';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const useStepEndedWithoutResult = ({ sessionId, agentId }: Params): boolean => {
  const agent = useAppStore((state) =>
    (state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).find(
      (candidate) => candidate.id === agentId,
    ),
  );
  const kindOverride = useAppStore((state) => state.agentKindOverride[agentId] ?? null);
  const artifacts = useAppStore((state) => state.sessionArtifacts[sessionId]);
  const events = useAppStore((state) => state.transcripts[agentId]);
  const loadAgentTranscript = useAppStore((state) => state.loadAgentTranscript);
  const reportError = useAppStore((state) => state.reportError);
  const isLoaded = events !== undefined;
  const isBlocked = agent?.status === 'blocked';
  useEffect(() => {
    if (isLoaded || !isBlocked) {
      return;
    }
    void loadAgentTranscript(sessionId, agentId, { isSelecting: false }).catch((error: unknown) => {
      if (!isReportedError(error)) {
        void reportError({ title: "Couldn't read what the step said", error, sessionId });
      }
    });
  }, [isLoaded, isBlocked, loadAgentTranscript, reportError, sessionId, agentId]);
  const isMissingArtifact =
    agent !== undefined &&
    isAgentMissingArtifact({
      agent,
      kind: classifyAgent({ agent, override: kindOverride }),
      artifacts,
    });
  return stepEndedWithoutResult({
    agent,
    isAsking: events !== undefined && blockedQuestionOf({ events })?.isQuestion === true,
    isMissingArtifact,
  });
};
