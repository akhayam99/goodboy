import { useState } from 'react';
import { Check, Play, RotateCcw, Undo2, type LucideIcon } from 'lucide-react';
import { Button, Tooltip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../../store';
import { openPlanDrawer } from '../../../../plans/openPlanDrawer';
import type { RunPrimaryKind } from '../../../../workflows/runPrimaryOf';
import { useAnswerQuestion } from '../../../../workflows/useAnswerQuestion';
import { useApproveRunPlan } from '../../../../workflows/useApproveRunPlan';
import type { RunView } from '../useRunView';

type RunButtonKind = Exclude<RunPrimaryKind, 'start-run' | 'start-step' | 'raise-cap'>;

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly kind: RunButtonKind;
  readonly label: string;
};

type Spec = {
  readonly icon: LucideIcon;
  readonly hint: string;
  readonly failure: string;
  readonly run: () => void | Promise<void>;
};

export const RunPrimaryButton = ({ session, view, kind, label }: Props) => {
  const sessionId = session.id;
  const runId = view.run.id;
  const [isBusy, setIsBusy] = useState(false);
  const approvePlan = useApproveRunPlan({ sessionId, runId });
  const answer = useAnswerQuestion({ sessionId });
  const reportError = useAppStore((state) => state.reportError);
  const resumeWorkflowRun = useAppStore((state) => state.resumeWorkflowRun);
  const retryWorkflowOrchestration = useAppStore((state) => state.retryWorkflowOrchestration);
  const orchestrateNextStep = useAppStore((state) => state.orchestrateNextStep);
  const restoreWorkflow = useAppStore((state) => state.restoreWorkflow);
  const question = view.answerQuestion;

  const specs: Record<RunButtonKind, Spec> = {
    'review-plan': {
      icon: CONCEPT_ICONS.plans,
      hint: 'Read the plan, comment on it or approve it',
      failure: "Couldn't open the plan",
      run: () => {
        if (view.plan !== null) {
          openPlanDrawer({ sessionId, planId: view.plan.id });
        }
      },
    },
    'approve-plan': {
      icon: Check,
      hint: 'Approve the plan and move the run on',
      failure: "Couldn't approve the plan",
      run: approvePlan,
    },
    answer: {
      icon: CONCEPT_ICONS.questions,
      hint: 'Open the question this run waits on',
      failure: "Couldn't open the question",
      run: () => {
        if (question !== null) {
          answer({ question });
        }
      },
    },
    resume: {
      icon: Play,
      hint: 'Start where the run left off',
      failure: "Couldn't resume the run",
      run: () => resumeWorkflowRun(sessionId, runId),
    },
    continue: {
      icon: Play,
      hint: 'Clear the stop and ask for the next step',
      failure: "Couldn't continue the run",
      run: () => retryWorkflowOrchestration(sessionId, runId),
    },
    retry: {
      icon: RotateCcw,
      hint: 'Ask the orchestrator for the next step again',
      failure: "Couldn't retry the run",
      run: () => retryWorkflowOrchestration(sessionId, runId),
    },
    'decide-next': {
      icon: CONCEPT_ICONS.orchestrator,
      hint: 'Ask the orchestrator to decide the next step',
      failure: "Couldn't ask for the next step",
      run: () => orchestrateNextStep(sessionId, runId),
    },
    restore: {
      icon: Undo2,
      hint: 'Bring this run back',
      failure: "Couldn't restore the run",
      run: () => restoreWorkflow(sessionId, runId),
    },
  };
  const spec = specs[kind];
  const Icon = spec.icon;

  const press = async () => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await spec.run();
    } catch (error) {
      await reportError({ title: spec.failure, error, sessionId });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Tooltip content={spec.hint} anchorClassName="shrink-0">
      <span className="inline-flex">
        <Button size="sm" variant="primary" isBusy={isBusy} onClick={() => void press()}>
          <Icon size={ICON_SIZE.control} aria-hidden />
          {label}
        </Button>
      </span>
    </Tooltip>
  );
};
