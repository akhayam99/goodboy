import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PlanWithCount, SessionId } from '@goodboy/types';
import { useSessionOpenQuestions } from '../../../../store';
import { isRunHeldForPlan } from '../../../../store/slices/workflows/workflowPlanApproval';
import { useCopyText } from '../../../../shared/hooks/useCopyText';
import { PlanCommentsContext } from '../../../plans/planComments/planCommentsContext';
import { usePlanComments } from '../../../plans/planComments/usePlanComments';
import type { SendArtifactCommentsResult } from '../../../../store/slices/artifact-comments/types';
import { PLANNER_QUESTION_REASON, plannerQuestionsOf } from '../../../plans/plannerQuestions';
import { usePlanPrimaryAction } from '../../../plans/usePlanPrimaryAction';
import { usePlanRevising } from '../../../plans/useRevisingPlans';
import { PlanCommentBar, type PlanCommentBarRan } from './PlanCommentBar';

type Props = {
  readonly sessionId: SessionId;
  readonly plan: PlanWithCount;
  readonly onSent?: (result: SendArtifactCommentsResult) => void;
  readonly children: ReactNode;
};

export const PlanCommentsProvider = ({ sessionId, plan, onSent, children }: Props) => {
  const model = usePlanComments({ sessionId, plan });
  const revising = usePlanRevising({ sessionId, planId: plan.id });
  const questions = useSessionOpenQuestions(sessionId);
  const action = usePlanPrimaryAction({ sessionId, plan, revising, isRunning: false });
  const copyText = useCopyText();
  const [status, setStatus] = useState<string | null>(null);
  const [isSendingToAgent, setIsSendingToAgent] = useState(false);
  const { send, sendToAgent, target, requestText, isPlanRan, draftSavesOk } = model;
  const { run, primary } = action;
  const hasQuestion = plannerQuestionsOf({ questions, plan }).length > 0;
  const waitsOnPlan = run !== null && isRunHeldForPlan({ run }) && primary.kind === 'approve';
  const guard = useMemo(
    () => (hasQuestion ? { canSend: false, reason: PLANNER_QUESTION_REASON } : model.guard),
    [hasQuestion, model.guard],
  );
  const sendAndTell = useCallback(async () => {
    if (!(await draftSavesOk())) {
      return null;
    }
    const result = await send();
    onSent?.(result);
    return result;
  }, [draftSavesOk, onSent, send]);
  const latestRequest = useRef(requestText);
  latestRequest.current = requestText;
  const ran = useMemo<PlanCommentBarRan | null>(() => {
    if (!isPlanRan) {
      return null;
    }
    return {
      agentName: target === null ? null : target.name,
      canSend: target !== null && target.canReceive,
      isSending: isSendingToAgent,
      onSend: async () => {
        setIsSendingToAgent(true);
        try {
          if (!(await draftSavesOk())) {
            return null;
          }
          const result = await sendToAgent();
          if (result.kind === 'sentToAgent') {
            setStatus(`Sent to ${result.agentName}.`);
          }
          return result;
        } finally {
          setIsSendingToAgent(false);
        }
      },
      onCopy: () => {
        void draftSavesOk().then((isOk) => {
          if (isOk) {
            void copyText({ text: latestRequest.current });
          }
        });
      },
    };
  }, [copyText, draftSavesOk, isPlanRan, isSendingToAgent, sendToAgent, target]);

  useEffect(() => {
    if (model.drafts.length > 0) {
      setStatus(null);
    }
  }, [model.drafts.length]);

  return (
    <PlanCommentsContext.Provider value={model.api}>
      {children}
      {model.drafts.length === 0 && !waitsOnPlan && status === null ? null : (
        <PlanCommentBar
          count={model.drafts.length}
          guard={guard}
          isSending={model.isSending}
          error={model.sendError}
          onSend={sendAndTell}
          ran={ran}
          status={status}
        />
      )}
    </PlanCommentsContext.Provider>
  );
};
