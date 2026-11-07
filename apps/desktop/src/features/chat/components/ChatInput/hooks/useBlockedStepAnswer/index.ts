import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { ORCHESTRATED_COPY } from '../../../../../workflows/orchestratedCopy';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly hasDraft: boolean;
  readonly isBlocked: boolean;
  readonly basePlaceholder: string;
  readonly onSend: () => Promise<void>;
};

export type BlockedStepAnswer = Readonly<{
  agentId: AgentId;
  runId: WorkflowRunId;
  isSending: boolean;
  error: string | null;
  send: () => Promise<void>;
}>;

type Result = Readonly<{
  step: BlockedStepAnswer | null;
  placeholder: string;
  sendDraft: () => void;
}>;

export const useBlockedStepAnswer = ({
  sessionId,
  agentId,
  hasDraft,
  isBlocked,
  basePlaceholder,
  onSend,
}: Params): Result => {
  const agent = useAppStore((state) =>
    agentId === null
      ? undefined
      : (state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).find(
          (candidate) => candidate.id === agentId,
        ),
  );
  const answerBlockedStep = useAppStore((state) => state.answerBlockedStep);
  const askAgentToContinue = useAppStore((state) => state.askAgentToContinue);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const target = agent?.status === 'blocked' && agent.parentAgentId == null ? agent : undefined;
  const targetId = target?.id ?? null;

  const send = useCallback(async (): Promise<void> => {
    if (targetId === null || isSending) {
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      const text = (useAppStore.getState().agentDraft[targetId] ?? '').trim();
      if (text === '') {
        await askAgentToContinue({ sessionId, agentId: targetId });
        return;
      }
      await answerBlockedStep({ sessionId, agentId: targetId, text });
      useAppStore.getState().clearAgentDraft(targetId);
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsSending(false);
    }
  }, [targetId, isSending, sessionId, answerBlockedStep, askAgentToContinue]);

  const step: BlockedStepAnswer | null =
    target === undefined || target.workflowRunId == null
      ? null
      : { agentId: target.id, runId: target.workflowRunId, isSending, error, send };
  const sendDraft = () => {
    if (step !== null && hasDraft) {
      void step.send();
      return;
    }
    void onSend();
  };
  const placeholder =
    !isBlocked && step !== null ? ORCHESTRATED_COPY.blockedAnswerLabel : basePlaceholder;
  return { step, placeholder, sendDraft };
};
