import { useCallback, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { AgentId, SessionId, TurnProviderOverride, WorkflowRunId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { useConversationAsks } from '../../../../../../store/hooks/useConversationAsks';
import { restoreDraftOnFailedSend } from '../../../../../../shared/utils/restoreDraftOnFailedSend';
import { ORCHESTRATED_COPY } from '../../../../../workflows/orchestratedCopy';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly hasDraft: boolean;
  readonly hasAttachments: boolean;
  readonly isBlocked: boolean;
  readonly override: TurnProviderOverride | undefined;
  readonly basePlaceholder: string;
  readonly onSend: () => Promise<void>;
};

export type BlockedStepAnswer = Readonly<{
  agentId: AgentId;
  runId: WorkflowRunId;
  isSending: boolean;
  isComposerBlocked: boolean;
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
  hasAttachments,
  isBlocked,
  override,
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
  const isInFlight = useRef(false);
  const isTurnLive = useAppStore((state) => {
    const kind = agentId === null ? undefined : state.agentTurnState[agentId]?.kind;
    return kind === 'running' || kind === 'starting';
  });
  const { permissions, questions } = useConversationAsks({ sessionId, agentId });
  const isAnswerable = !isTurnLive && permissions.length + questions.length === 0;
  const target =
    isAnswerable && agent?.status === 'blocked' && agent.parentAgentId == null ? agent : undefined;
  const targetId = target?.id ?? null;

  const send = useCallback(async (): Promise<void> => {
    if (targetId === null || isBlocked || isInFlight.current) {
      return;
    }
    if (hasAttachments) {
      setError(ORCHESTRATED_COPY.blockedAnswerAttachments);
      return;
    }
    isInFlight.current = true;
    setIsSending(true);
    setError(null);
    const sent = useAppStore.getState().agentDraft[targetId] ?? '';
    try {
      if (sent.trim() === '') {
        await askAgentToContinue({
          sessionId,
          agentId: targetId,
          ...(override !== undefined && { override }),
        });
        return;
      }
      useAppStore.getState().clearAgentDraft(targetId);
      try {
        await answerBlockedStep({
          sessionId,
          agentId: targetId,
          text: sent,
          ...(override !== undefined && { override }),
        });
      } catch (cause) {
        const current = useAppStore.getState().agentDraft[targetId] ?? '';
        useAppStore.getState().setAgentDraft(targetId, restoreDraftOnFailedSend({ sent, current }));
        throw cause;
      }
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      isInFlight.current = false;
      setIsSending(false);
    }
  }, [
    targetId,
    isBlocked,
    hasAttachments,
    sessionId,
    override,
    answerBlockedStep,
    askAgentToContinue,
  ]);

  const step: BlockedStepAnswer | null =
    target === undefined || target.workflowRunId == null
      ? null
      : {
          agentId: target.id,
          runId: target.workflowRunId,
          isSending,
          isComposerBlocked: isBlocked,
          error,
          send,
        };
  const sendDraft = () => {
    if (step !== null && !isBlocked && hasDraft) {
      void step.send();
      return;
    }
    void onSend();
  };
  const placeholder =
    !isBlocked && step !== null && !hasAttachments
      ? ORCHESTRATED_COPY.blockedAnswerLabel
      : basePlaceholder;
  return { step, placeholder, sendDraft };
};
