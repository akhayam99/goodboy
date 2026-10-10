import { useState } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import type { Agent, SessionId, WorkflowAutonomy, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { openPlanDrawer } from '../../../plans/openPlanDrawer';
import { PLAN_REVISING_REASON } from '../../../plans/planRevising';
import { usePlanRevising } from '../../../plans/useRevisingPlans';
import { useApproveRunPlan } from '../../useApproveRunPlan';
import { useRunPlan } from '../../useRunPlan';
import { isRunPaused } from '../../isRunPaused';
import { runAutonomyOf } from '../../runAutonomy';
import { OrchestratorAction } from '../OrchestratorStrip/OrchestratorAction';
import { WorkflowCloseButton } from '../WorkflowCloseButton';
import { RunControlMenu } from './RunControlMenu';

type AutonomyMenu = {
  readonly label: string;
  readonly onAutonomy: (autonomy: WorkflowAutonomy) => void;
};

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly isOrchestrating: boolean;
  readonly isRunOver: boolean;
  readonly onClose?: (() => void) | null;
  readonly autonomyMenu?: AutonomyMenu | null;
};

const PLAN_MENU_LABEL = 'Plan actions';

export const RunControls = ({
  sessionId,
  run,
  agents,
  isOrchestrating,
  isRunOver,
  onClose = null,
  autonomyMenu = null,
}: Props) => {
  const pauseWorkflowRun = useAppStore((state) => state.pauseWorkflowRun);
  const resumeWorkflowRun = useAppStore((state) => state.resumeWorkflowRun);
  const approvePlan = useApproveRunPlan({ sessionId, runId: run.id });
  const plan = useRunPlan({ sessionId, runId: run.id });
  const revising = usePlanRevising({ sessionId, planId: plan?.id ?? null });
  const [isBusy, setIsBusy] = useState(false);
  const isPaused = isRunPaused({ run });
  const isHeldForPlan = run.orchestrationStop?.kind === 'plan-approval';
  const isStopped = run.orchestrationStop?.kind === 'operator';
  const hasStepInFlight = agents.some((agent) => agent.status === 'running');
  const isLive = isOrchestrating || hasStepInFlight;
  if (isRunOver || run.discardedAt != null) {
    return null;
  }

  const guard = async (action: () => Promise<void>) => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  const hasPlanToReview = isHeldForPlan && plan !== null;
  const approveItem = hasPlanToReview
    ? {
        reason: revising.kind === 'revising' ? PLAN_REVISING_REASON : null,
        onApprove: () => void guard(approvePlan),
      }
    : null;
  const canPause = !isPaused && !isStopped && isLive;
  const hasPair = isPaused || canPause || onClose !== null;
  const hasPrimaryAction = isHeldForPlan;

  return (
    <>
      {hasPair ? (
        <div role="group" aria-label="Run controls" className="flex items-center gap-1">
          {isPaused ? (
            <OrchestratorAction
              icon={Play}
              label="Resume"
              variant={hasPrimaryAction ? 'secondary' : 'primary'}
              testId="run-resume"
              title="Start where the run left off"
              disabled={isBusy}
              onClick={() => void guard(() => resumeWorkflowRun(sessionId, run.id))}
            />
          ) : null}
          {canPause ? (
            <OrchestratorAction
              icon={Pause}
              label="Pause"
              variant="secondary"
              testId="run-pause"
              title="Finish the step in flight and start no others"
              disabled={isBusy}
              onClick={() => void guard(() => pauseWorkflowRun(sessionId, run.id))}
            />
          ) : null}
          {onClose === null ? null : <WorkflowCloseButton onConfirm={onClose} />}
        </div>
      ) : null}
      {hasPlanToReview ? (
        <OrchestratorAction
          icon={CONCEPT_ICONS.plans}
          label="Review plan"
          variant="primary"
          testId="run-review-plan"
          title="Read the plan, comment on it or approve it"
          onClick={() => openPlanDrawer({ sessionId, planId: plan.id })}
        />
      ) : null}
      {isHeldForPlan && plan === null ? (
        <OrchestratorAction
          icon={Check}
          label="Approve plan"
          variant="primary"
          testId="run-approve-plan"
          title="Approve the plan and move the run on"
          disabled={isBusy}
          onClick={() => void guard(approvePlan)}
        />
      ) : null}
      {autonomyMenu === null && approveItem !== null ? (
        <OrchestratorAction
          icon={Check}
          label="Approve plan"
          variant="ghost"
          testId="run-approve-plan-ghost"
          title={approveItem.reason ?? 'Approve the plan and move the run on'}
          disabled={isBusy || approveItem.reason !== null}
          onClick={approveItem.onApprove}
        />
      ) : null}
      {autonomyMenu === null ? null : (
        <RunControlMenu
          label={autonomyMenu?.label ?? PLAN_MENU_LABEL}
          autonomy={
            autonomyMenu === null
              ? null
              : {
                  value: runAutonomyOf({
                    autoRun: run.autoRun,
                    autonomy: run.rulesSnapshot?.autonomy,
                  }).key,
                  onChange: autonomyMenu.onAutonomy,
                }
          }
          approvePlan={approveItem}
        />
      )}
    </>
  );
};
