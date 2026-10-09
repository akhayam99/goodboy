import { useEffect, useState } from 'react';
import { Play, RotateCcw, Wallet } from 'lucide-react';
import { ClampedProse, StatusDot, ToneBar, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type {
  Agent,
  BudgetAlert,
  GoalAttachment,
  OpenQuestion,
  OrchestratorHint,
  SessionId,
  Step,
  WorkflowRun,
} from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import {
  workflowRunHasOpenQuestions,
  workflowRunOpenQuestions,
} from '../../../context/openQuestionsGate';
import { requestSessionSpendLimitEdit } from '../../../budget/requestSessionSpendLimitEdit';
import { isBudgetBlocked } from '../../../../store/slices/workflows/budgetBlock';
import { WorkflowNodeRouting } from '../WorkflowNodeRouting';
import { RunSpendLimitPopover } from '../RunSpendLimitPopover';
import { OrchestratorAction } from './OrchestratorAction';
import { OrchestratorHintLog } from './OrchestratorHintLog';
import { RunControlMenu } from '../RunControls/RunControlMenu';
import { OrchestratorRoutingRow } from './OrchestratorRoutingRow';
import { NO_PLAN_SIGNAL, resolveOrchestratorState, type PlanSignal } from './orchestratorState';
import { StopStepButton } from './StopStepButton';
import { runAutonomyOf } from '../../runAutonomy';
import { useElapsedLabel } from './useElapsedLabel';
import { useRunPlan } from '../../useRunPlan';
import { openPlanDrawer } from '../../../plans/openPlanDrawer';
import { usePlanRevising } from '../../../plans/useRevisingPlans';
import { useAnswerQuestion } from '../../useAnswerQuestion';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly steps: ReadonlyArray<Step>;
  readonly costUsd: number;
  readonly isOrchestrating: boolean;
};

const EMPTY_QUESTIONS: ReadonlyArray<OpenQuestion> = [];
const EMPTY_ALERTS: ReadonlyArray<BudgetAlert> = [];
const EMPTY_HINTS: ReadonlyArray<OrchestratorHint> = [];
const EMPTY_READING: ReadonlyArray<string> = [];
const EMPTY_FILES: ReadonlyArray<GoalAttachment> = [];

export const OrchestratorStrip = ({
  sessionId,
  run,
  agents,
  steps,
  costUsd,
  isOrchestrating,
}: Props) => {
  const orchestrateNextStep = useAppStore((state) => state.orchestrateNextStep);
  const retryWorkflowOrchestration = useAppStore((state) => state.retryWorkflowOrchestration);
  const continueWorkflowRun = useAppStore((state) => state.continueWorkflowRun);
  const reportError = useAppStore((state) => state.reportError);
  const removeWorkflowOrchestratorHint = useAppStore(
    (state) => state.removeWorkflowOrchestratorHint,
  );
  const setWorkflowRunAutonomy = useAppStore((state) => state.setWorkflowRunAutonomy);
  const openQuestions = useAppStore(
    (state) => state.sessionOpenQuestions[sessionId] ?? EMPTY_QUESTIONS,
  );
  const sessionBudgetBlocked = useAppStore((state) =>
    isBudgetBlocked({
      alerts: state.budgetAlerts ?? EMPTY_ALERTS,
      budgets: state.sessionBudgets,
      sessionId,
    }),
  );
  const readingHintIds = useAppStore(
    (state) => state.orchestratorReadingHints[run.id] ?? EMPTY_READING,
  );
  const [isRoutingOpen, setIsRoutingOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const hints = run.orchestratorHints ?? EMPTY_HINTS;
  const runAttachments = useAppStore(
    (state) => state.workflowRunAttachments[run.id] ?? EMPTY_FILES,
  );
  const hasLoadedFiles = useAppStore((state) => state.workflowRunAttachments[run.id] !== undefined);
  const loadGoalAttachments = useAppStore((state) => state.loadGoalAttachments);
  const hasHintFiles = hints.some((hint) => (hint.attachmentIds?.length ?? 0) > 0);

  useEffect(() => {
    if (!hasHintFiles || hasLoadedFiles) {
      return;
    }
    void loadGoalAttachments({ type: 'workflow_run', id: run.id }).catch(() => undefined);
  }, [hasHintFiles, hasLoadedFiles, loadGoalAttachments, run.id]);

  const plan = useRunPlan({ sessionId, runId: run.id });
  const planRevising = usePlanRevising({ sessionId, planId: plan?.id ?? null });
  const answer = useAnswerQuestion({ sessionId });
  const planQuestion =
    plan === null
      ? null
      : (openQuestions.find(
          (question) => question.status === 'open' && question.createdByAgentId === plan.agentId,
        ) ?? null);
  const planSignal: PlanSignal =
    planQuestion !== null
      ? { kind: 'question', question: planQuestion }
      : planRevising.kind === 'revising'
        ? { kind: 'revising' }
        : NO_PLAN_SIGNAL;
  const runQuestion = workflowRunOpenQuestions({ questions: openQuestions, run })[0] ?? null;
  const state = resolveOrchestratorState({
    run,
    agents,
    isOrchestrating,
    hasOpenQuestions: workflowRunHasOpenQuestions({ questions: openQuestions, run }),
    question: runQuestion,
    costUsd,
    plan: planSignal,
  });
  const elapsed = useElapsedLabel({ agentId: state.waitingOnAgentId });
  const isPulsing =
    state.phase === 'deciding' ||
    state.phase === 'automatic' ||
    state.phase === 'stopping' ||
    state.phase === 'plan-revising';
  const pulseTone = state.tone === 'neutral' ? 'info' : state.tone;
  const runningStep =
    agents.find((agent) => agent.parentAgentId == null && agent.status === 'running') ?? null;
  const hasRouting = agents.length > 0;

  const guard = async (action: () => Promise<void>) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const primaryAction = (() => {
    switch (state.phase) {
      case 'ready-first':
      case 'ready-mid':
        return run.autoRun === true ? null : (
          <OrchestratorAction
            icon={CONCEPT_ICONS.orchestrator}
            label="Decide next step"
            variant="primary"
            testId="workflow-orchestrate-next-cta"
            title="Ask the orchestrator to decide the next step"
            disabled={busy}
            onClick={() => void guard(() => orchestrateNextStep(sessionId, run.id))}
          />
        );
      case 'paused-budget':
        return sessionBudgetBlocked ? (
          <OrchestratorAction
            icon={Wallet}
            label="Raise spend cap"
            variant="primary"
            tone="warning"
            testId="orchestrator-raise-session-limit"
            title="The spend cap of this session is what paused this run"
            onClick={() => requestSessionSpendLimitEdit({ sessionId })}
          />
        ) : (
          <RunSpendLimitPopover sessionId={sessionId} run={run} variant="primary" />
        );
      case 'stopped':
        return (
          <OrchestratorAction
            icon={Play}
            label="Continue the run"
            variant="primary"
            tone="warning"
            testId="orchestrator-resume"
            title="Clear the stop and ask for the next step"
            disabled={busy}
            onClick={() => void guard(() => retryWorkflowOrchestration(sessionId, run.id))}
          />
        );
      case 'failed':
      case 'blocked':
        return (
          <OrchestratorAction
            icon={RotateCcw}
            label="Retry"
            variant="primary"
            testId="orchestrator-retry"
            disabled={busy}
            onClick={() => void guard(() => retryWorkflowOrchestration(sessionId, run.id))}
          />
        );
      case 'done':
        return (
          <OrchestratorAction
            icon={Play}
            label="Continue the run"
            variant="primary"
            testId="orchestrator-continue"
            title="Ask the orchestrator for more. To say what is missing, send it a hint to read now."
            disabled={busy}
            onClick={() => void guard(() => continueWorkflowRun(sessionId, run.id))}
          />
        );
      case 'plan-approval':
        return plan === null ? null : (
          <OrchestratorAction
            icon={CONCEPT_ICONS.plans}
            label="Open plan"
            variant="secondary"
            testId="orchestrator-review-plan"
            title="Read the plan, comment on it or approve it"
            onClick={() => openPlanDrawer({ sessionId, planId: plan.id })}
          />
        );
      case 'plan-question':
        return planQuestion === null ? null : (
          <OrchestratorAction
            icon={CONCEPT_ICONS.questions}
            label="Answer"
            variant="primary"
            tone="warning"
            testId="orchestrator-answer-plan-question"
            title="Open the planner's question"
            onClick={() => answer({ question: planQuestion })}
          />
        );
      case 'needs-answer':
        return runQuestion === null ? null : (
          <OrchestratorAction
            icon={CONCEPT_ICONS.questions}
            label="Answer"
            variant="primary"
            tone="warning"
            testId="orchestrator-answer-question"
            title="Open the question this run waits on"
            onClick={() => answer({ question: runQuestion })}
          />
        );
      case 'deciding':
      case 'plan-revising':
      case 'paused':
      case 'stopping':
      case 'waiting':
      case 'automatic':
      case 'needs-approval':
      case 'step-failed':
        return null;
      default: {
        const exhaustive: never = state.phase;
        return exhaustive;
      }
    }
  })();

  return (
    <section
      data-testid="orchestrator-strip"
      data-phase={state.phase}
      aria-label="Orchestrator"
      className="flex min-w-0 flex-col gap-2"
    >
      <div
        data-testid="orchestrator-strip-row"
        className="relative flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border-soft bg-background py-2 pl-4 pr-2"
      >
        <ToneBar tone={state.tone} density="card" />
        <div className="flex min-w-0 max-w-full flex-auto items-center gap-3">
          <span className="flex h-4 shrink-0 items-center" aria-hidden={!isPulsing}>
            {isPulsing ? (
              <StatusDot tone={pulseTone} size="sm" pulsing ariaLabel={state.sentence} />
            ) : (
              <CONCEPT_ICONS.orchestrator
                size={ICON_SIZE.row}
                aria-hidden
                className={
                  state.tone === 'neutral' ? 'text-muted-foreground' : tintClasses(state.tone).icon
                }
              />
            )}
          </span>
          <p className="flex min-w-0 flex-1 items-baseline gap-2">
            <span
              data-testid="orchestrator-state"
              className="min-w-0 truncate text-row text-foreground"
              title={state.sentence}
            >
              {state.sentence}
            </span>
            {elapsed == null ? null : (
              <span
                data-testid="orchestrator-elapsed"
                className="shrink-0 text-meta tabular-nums text-muted-foreground"
              >
                {elapsed}
              </span>
            )}
          </p>
        </div>
        <div
          data-testid="orchestrator-controls"
          className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2"
        >
          {primaryAction}
          {runningStep !== null && state.phase !== 'stopping' ? (
            <StopStepButton
              sessionId={sessionId}
              runId={run.id}
              agent={runningStep}
              disabled={busy}
            />
          ) : null}
          <OrchestratorRoutingRow
            sessionId={sessionId}
            run={run}
            disabled={busy || isOrchestrating}
          />
          <RunControlMenu
            label="Orchestrator actions"
            autonomy={{
              value: runAutonomyOf({ autoRun: run.autoRun, autonomy: run.rulesSnapshot?.autonomy })
                .key,
              onChange: (autonomy) => void setWorkflowRunAutonomy(sessionId, run.id, autonomy),
            }}
            routing={
              hasRouting
                ? { isOpen: isRoutingOpen, onToggle: () => setIsRoutingOpen((open) => !open) }
                : null
            }
          />
        </div>
        {state.detail != null && state.detail !== '' ? (
          <div data-testid="orchestrator-detail" className="min-w-0 basis-full">
            <ClampedProse
              text={state.detail}
              lines={2}
              className="text-meta leading-relaxed text-muted-foreground"
            />
          </div>
        ) : null}
      </div>

      <OrchestratorHintLog
        hints={hints}
        readingHintIds={readingHintIds}
        runAttachments={runAttachments}
        onRemove={(hintId) =>
          void removeWorkflowOrchestratorHint(sessionId, run.id, hintId).catch((error: unknown) =>
            reportError({ title: "Couldn't remove the hint", error, sessionId }),
          )
        }
      />

      {isRoutingOpen && hasRouting ? (
        <WorkflowNodeRouting
          sessionId={sessionId}
          workflowRunId={run.id}
          steps={steps}
          onClose={() => setIsRoutingOpen(false)}
        />
      ) : null}
    </section>
  );
};
