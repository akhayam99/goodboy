import { updateWorkflowRunOrchestrationStop } from '@goodboy/db';
import type {
  PlanWithCount,
  SessionId,
  WorkflowOrchestrationStop,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { listPlansForSession } from '../../../features/plans/plans';
import { isRunPaused } from '../../../features/workflows/isRunPaused';
import { tauriDatabase } from '../../../shared/lib/db';
import { patchWorkflowRun } from './patchWorkflowRun';
import type { SetFn } from './types';

const PLAN_APPROVAL_MESSAGE = 'The plan is ready. Approve it to start the rest of the run.';

export type WorkflowAdmissionBlock = 'paused' | 'plan-approval';

type RunParams = {
  readonly run: Pick<WorkflowRun, 'orchestrationStop'> | null | undefined;
};

export const isRunHeldForPlan = ({ run }: RunParams): boolean =>
  run?.orchestrationStop?.kind === 'plan-approval';

export const heldAdmissionBlock = ({ run }: RunParams): WorkflowAdmissionBlock | null => {
  if (isRunPaused({ run })) {
    return 'paused';
  }
  if (isRunHeldForPlan({ run })) {
    return 'plan-approval';
  }
  return null;
};

const waitsForPlanApproval = ({ run }: { readonly run: WorkflowRun }): boolean =>
  run.rulesSnapshot?.autonomy === 'plan' && run.rulesSnapshot.planApproved !== true;

type GateParams = {
  readonly run: WorkflowRun;
  readonly plans: ReadonlyArray<PlanWithCount>;
};

const workflowPlanNeedsApproval = ({ run, plans }: GateParams): boolean =>
  waitsForPlanApproval({ run }) &&
  plans.some(
    (plan) =>
      plan.workflowRunId === run.id && (plan.status === 'active' || plan.status === 'consumed'),
  );

type AdmitParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const admitWorkflowRun = async ({
  set,
  sessionId,
  run,
}: AdmitParams): Promise<WorkflowAdmissionBlock | null> => {
  const held = heldAdmissionBlock({ run });
  if (held !== null) {
    return held;
  }
  if (!waitsForPlanApproval({ run })) {
    return null;
  }
  const plans = await listPlansForSession(sessionId);
  if (!workflowPlanNeedsApproval({ run, plans })) {
    return null;
  }
  const stop: WorkflowOrchestrationStop = { kind: 'plan-approval', message: PLAN_APPROVAL_MESSAGE };
  await updateWorkflowRunOrchestrationStop(tauriDatabase, run.id, stop);
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId: run.id as WorkflowRunId,
    patch: (current) => ({ ...current, orchestrationStop: stop }),
  });
  return 'plan-approval';
};
