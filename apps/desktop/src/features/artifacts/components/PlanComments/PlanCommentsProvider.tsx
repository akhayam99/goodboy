import { useCallback, useMemo, type ReactNode } from 'react';
import type { PlanWithCount, SessionId } from '@goodboy/types';
import { useSessionOpenQuestions } from '../../../../store';
import { isRunHeldForPlan } from '../../../../store/slices/workflows/workflowPlanApproval';
import { PlanCommentsContext } from '../../../plans/planComments/planCommentsContext';
import { usePlanComments } from '../../../plans/planComments/usePlanComments';
import type { SendArtifactCommentsResult } from '../../../../store/slices/artifact-comments/types';
import { PLANNER_QUESTION_REASON, plannerQuestionsOf } from '../../../plans/plannerQuestions';
import { usePlanPrimaryAction } from '../../../plans/usePlanPrimaryAction';
import { usePlanRevising } from '../../../plans/useRevisingPlans';
import { PlanCommentBar } from './PlanCommentBar';

type Props = {
  readonly sessionId: SessionId;
  readonly plan: PlanWithCount;
  readonly onSent?: (result: SendArtifactCommentsResult) => void;
  readonly isApproveInBar?: boolean;
  readonly children: ReactNode;
};

export const PlanCommentsProvider = ({
  sessionId,
  plan,
  onSent,
  isApproveInBar = true,
  children,
}: Props) => {
  const model = usePlanComments({ sessionId, plan });
  const revising = usePlanRevising({ sessionId, planId: plan.id });
  const questions = useSessionOpenQuestions(sessionId);
  const action = usePlanPrimaryAction({ sessionId, plan, revising, isRunning: false });
  const { send } = model;
  const { run, primary } = action;
  const hasQuestion = plannerQuestionsOf({ questions, plan }).length > 0;
  const waitsOnPlan = run !== null && isRunHeldForPlan({ run }) && primary.kind === 'approve';
  const guard = useMemo(
    () => (hasQuestion ? { canSend: false, reason: PLANNER_QUESTION_REASON } : model.guard),
    [hasQuestion, model.guard],
  );
  const sendAndTell = useCallback(async () => {
    const result = await send();
    onSent?.(result);
    return result;
  }, [onSent, send]);

  return (
    <PlanCommentsContext.Provider value={model.api}>
      {children}
      {model.drafts.length === 0 && !waitsOnPlan ? null : (
        <PlanCommentBar
          count={model.drafts.length}
          guard={guard}
          isSending={model.isSending}
          error={model.sendError}
          onSend={sendAndTell}
          approve={waitsOnPlan && isApproveInBar ? action : null}
        />
      )}
    </PlanCommentsContext.Provider>
  );
};
