import type { ReactNode } from 'react';
import type { PlanWithCount, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isRunHeldForPlan } from '../../../../store/slices/workflows/workflowPlanApproval';
import { PlanCommentsContext } from '../../../plans/planComments/planCommentsContext';
import { usePlanComments } from '../../../plans/planComments/usePlanComments';
import { PlanCommentBar } from './PlanCommentBar';

type Props = {
  readonly sessionId: SessionId;
  readonly plan: PlanWithCount;
  readonly children: ReactNode;
};

export const PlanCommentsProvider = ({ sessionId, plan, children }: Props) => {
  const model = usePlanComments({ sessionId, plan });
  const approveWorkflowRunPlan = useAppStore((state) => state.approveWorkflowRunPlan);
  const { run } = model;
  const onApprove =
    run !== null && isRunHeldForPlan({ run }) && !model.isRevising
      ? () => approveWorkflowRunPlan(sessionId, run.id)
      : null;

  return (
    <PlanCommentsContext.Provider value={model.api}>
      {children}
      {model.drafts.length === 0 ? null : (
        <PlanCommentBar
          count={model.drafts.length}
          guard={model.guard}
          isSending={model.isSending}
          error={model.sendError}
          onSend={model.send}
          onApprove={onApprove}
        />
      )}
    </PlanCommentsContext.Provider>
  );
};
