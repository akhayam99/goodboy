import { useState } from 'react';
import { CircleStop, PenLine, Play, RotateCcw, Wallet } from 'lucide-react';
import {
  ConfirmPopover,
  Eyebrow,
  GhostActionButton,
  Markdown,
  StatusDot,
  cn,
  tintClasses,
} from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type {
  Agent,
  BudgetAlert,
  OpenQuestion,
  OrchestratorHint,
  SessionId,
  Step,
  WorkflowRun,
} from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { workflowRunHasOpenQuestions } from '../../../context/openQuestionsGate';
import { openImpactStudio } from '../../../impact/openImpactStudio';
import { isBudgetBlocked } from '../../../../store/slices/workflows/budgetBlock';
import { WorkflowAutorunToggle } from '../WorkflowAutorunToggle';
import { WorkflowNodeRouting } from '../WorkflowNodeRouting';
import { WorkflowOrchestratorTldr } from '../WorkflowOrchestratorTldr';
import { RunSpendLimitPopover } from '../RunSpendLimitPopover';
import { OrchestratorAction } from './OrchestratorAction';
import { OrchestratorDrawer } from './OrchestratorDrawer';
import { OrchestratorHintComposer } from './OrchestratorHintComposer';
import { OrchestratorHintLog } from './OrchestratorHintLog';
import { OrchestratorRoutingRow } from './OrchestratorRoutingRow';
import { orchestratorHintStatus } from './orchestratorHintStatus';
import { resolveOrchestratorState } from './orchestratorState';
import { useElapsedLabel } from './useElapsedLabel';

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

export const OrchestratorPanel = ({
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
  const addWorkflowOrchestratorHint = useAppStore((state) => state.addWorkflowOrchestratorHint);
  const reportError = useAppStore((state) => state.reportError);
  const removeWorkflowOrchestratorHint = useAppStore(
    (state) => state.removeWorkflowOrchestratorHint,
  );
  const setWorkflowRunAutoRun = useAppStore((state) => state.setWorkflowRunAutoRun);
  const stopWorkflowRunNow = useAppStore((state) => state.stopWorkflowRunNow);
  const openQuestions = useAppStore(
    (state) => state.sessionOpenQuestions[sessionId] ?? EMPTY_QUESTIONS,
  );
  const sessionBudgetBlocked = useAppStore((state) =>
    isBudgetBlocked({ alerts: state.budgetAlerts ?? EMPTY_ALERTS, sessionId }),
  );
  const readingHintIds = useAppStore(
    (state) => state.orchestratorReadingHints[run.id] ?? EMPTY_READING,
  );
  const [isHintsOpen, setIsHintsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const hints = run.orchestratorHints ?? EMPTY_HINTS;
  const queuedHintCount = hints.filter(
    (hint) => orchestratorHintStatus({ hint, readingHintIds }) === 'queued',
  ).length;

  const state = resolveOrchestratorState({
    run,
    agents,
    isOrchestrating,
    hasOpenQuestions: workflowRunHasOpenQuestions({ questions: openQuestions, run }),
    costUsd,
  });
  const elapsed = useElapsedLabel({ since: state.waitingSince });
  const tint = tintClasses(state.tone);
  const isDeciding = state.phase === 'deciding';
  const isPulsing =
    isDeciding ||
    state.phase === 'automatic' ||
    state.phase === 'stopping' ||
    state.phase === 'stopping-graceful';
  const pulseTone = state.tone === 'neutral' ? 'info' : state.tone;
  const isRunOver = state.phase === 'done';
  const isStepInFlight = isOrchestrating || agents.some((agent) => agent.status === 'running');
  const showStopNow = isStepInFlight && run.orchestrationStop?.kind !== 'operator';

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
        return (
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
            label="Review budget"
            variant="primary"
            tone="warning"
            testId="orchestrator-review-budget"
            title="The session budget cap is what stopped this run"
            onClick={() => openImpactStudio({ scope: { kind: 'session', sessionId } })}
          />
        ) : (
          <RunSpendLimitPopover sessionId={sessionId} run={run} variant="primary" />
        );
      case 'stopped':
        return (
          <OrchestratorAction
            icon={Play}
            label="Resume the run"
            variant="primary"
            tone="warning"
            testId="orchestrator-resume"
            title="Clear the stop, put autorun back on, and ask for the next step"
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
      case 'needs-answer':
      case 'step-failed':
      default:
        return null;
    }
  })();

  return (
    <section
      data-testid="orchestrator-panel"
      data-phase={state.phase}
      aria-label="Orchestrator"
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-3 py-2.5',
        state.tone === 'neutral'
          ? 'border-border-soft bg-subtle'
          : cn(tint.borderSoft, tint.bgSoft),
        isDeciding && 'spin-border spin-border-info',
      )}
    >
      <div data-testid="orchestrator-header" className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md',
            state.tone === 'neutral' ? 'bg-muted' : tint.bg,
          )}
        >
          <CONCEPT_ICONS.orchestrator
            size={ICON_SIZE.row}
            aria-hidden
            className={state.tone === 'neutral' ? 'text-muted-foreground' : tint.icon}
          />
        </span>
        <span className="min-w-0 flex-1">
          <Eyebrow label="Orchestrator" muted />
        </span>
        <div
          data-testid="orchestrator-controls"
          className="flex shrink-0 flex-wrap items-center justify-end gap-1.5"
        >
          <OrchestratorRoutingRow
            sessionId={sessionId}
            run={run}
            disabled={busy || isOrchestrating}
          />
          {isRunOver ? null : (
            <WorkflowAutorunToggle
              variant="detail"
              isOn={run.autoRun === true}
              onToggle={() => void setWorkflowRunAutoRun(sessionId, run.id, run.autoRun !== true)}
            />
          )}
          {showStopNow ? (
            <ConfirmPopover
              role="alert"
              icon={<CircleStop size={ICON_SIZE.row} aria-hidden />}
              title="Stop now?"
              description="The step in flight is cancelled and marked skipped. Everything it already wrote is kept."
              confirmLabel="Stop now"
              onConfirm={() => void stopWorkflowRunNow(sessionId, run.id)}
              trigger={({ arm }) => (
                <GhostActionButton icon={CircleStop} tone="danger" label="Stop now" onClick={arm} />
              )}
            />
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <p
          data-testid="orchestrator-state"
          className={cn(
            'flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-medium',
            state.tone === 'neutral' ? 'text-foreground' : tint.text,
          )}
        >
          {isPulsing ? (
            <StatusDot tone={pulseTone} size="sm" pulsing ariaLabel={state.sentence} />
          ) : null}
          <span className="min-w-0">{state.sentence}</span>
          {elapsed == null ? null : (
            <span
              data-testid="orchestrator-elapsed"
              className="tabular-nums font-normal text-muted-foreground"
            >
              · {elapsed}
            </span>
          )}
          {queuedHintCount === 0 ? null : (
            <span data-testid="orchestrator-queued-hints" className="font-normal text-warning">
              · {queuedHintCount} {queuedHintCount === 1 ? 'hint' : 'hints'} queued
            </span>
          )}
        </p>
        {state.detail != null && state.detail !== '' ? (
          <div data-testid="orchestrator-detail" className="min-w-0">
            <Markdown text={state.detail} className="text-2xs leading-relaxed" />
          </div>
        ) : null}
      </div>

      <div data-testid="orchestrator-actions" className="flex flex-wrap items-center gap-1.5">
        {primaryAction}
        <OrchestratorAction
          icon={PenLine}
          label={hints.length === 0 ? 'Hints' : `Hints (${hints.length})`}
          variant="ghost"
          testId="orchestrator-hints-toggle"
          title="Tell the orchestrator something, and see what you already told it"
          expanded={isHintsOpen}
          onClick={() => setIsHintsOpen((open) => !open)}
        />
      </div>

      {isHintsOpen ? (
        <OrchestratorDrawer
          inputId="orchestrator-hint-field"
          title="Hints"
          help="The orchestrator rereads every hint at each decision and judges which still apply. Ask it for a provider or a model here too. Remove a hint to take it back."
        >
          <OrchestratorHintComposer
            isDeciding={isOrchestrating}
            isStepRunning={agents.some((agent) => agent.status === 'running')}
            onSubmit={async (draft) => {
              try {
                await addWorkflowOrchestratorHint(sessionId, run.id, draft);
                return true;
              } catch (error) {
                void reportError({ title: "Couldn't save the hint", error, sessionId });
                return false;
              }
            }}
          />
          <OrchestratorHintLog
            hints={hints}
            readingHintIds={readingHintIds}
            onRemove={(hintId) =>
              void removeWorkflowOrchestratorHint(sessionId, run.id, hintId).catch(
                (error: unknown) =>
                  reportError({ title: "Couldn't remove the hint", error, sessionId }),
              )
            }
          />
        </OrchestratorDrawer>
      ) : null}

      <WorkflowNodeRouting sessionId={sessionId} workflowRunId={run.id} steps={steps} />

      <WorkflowOrchestratorTldr steps={steps} run={run} />
    </section>
  );
};
