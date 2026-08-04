import { useState } from 'react';
import { CircleHelp, PenLine, Play, RotateCcw, Wallet, Wand2 } from 'lucide-react';
import { Eyebrow, Markdown, StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { Agent, OpenQuestion, SessionId, Step, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import {
  BUDGET_BLOCK_MESSAGE,
  isBudgetBlocked,
} from '../../../../store/slices/workflows/budgetBlock';
import { workflowRunHasOpenQuestions } from '../../../context/openQuestionsGate';
import { openBudgetStudio } from '../../../budget/openBudgetStudio';
import { WorkflowOrchestratorTldr } from '../WorkflowOrchestratorTldr';
import { OrchestratorAction } from './OrchestratorAction';
import { OrchestratorRoutingRow } from './OrchestratorRoutingRow';
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
  const setWorkflowOrchestratorHints = useAppStore((state) => state.setWorkflowOrchestratorHints);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const openQuestions = useAppStore(
    (state) => state.sessionOpenQuestions[sessionId] ?? EMPTY_QUESTIONS,
  );
  const budgetAlerts = useAppStore((state) => state.budgetAlerts);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [hintsDraft, setHintsDraft] = useState(run.orchestratorHints ?? '');
  const [continueNote, setContinueNote] = useState('');
  const [continueOpen, setContinueOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const state = resolveOrchestratorState({
    run,
    agents,
    isOrchestrating,
    hasOpenQuestions: workflowRunHasOpenQuestions(openQuestions, run.id),
    isBudgetPaused:
      run.orchestrationError === BUDGET_BLOCK_MESSAGE ||
      (run.autoRun && isBudgetBlocked({ alerts: budgetAlerts, sessionId })),
    costUsd,
  });
  const elapsed = useElapsedLabel({ since: state.waitingSince });
  const tint = tintClasses(state.tone);
  const isDeciding = state.phase === 'deciding';
  const isPulsing = isDeciding || state.phase === 'automatic';

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

  return (
    <section
      data-testid="orchestrator-panel"
      data-phase={state.phase}
      aria-label="Orchestrator"
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-3 py-2.5',
        state.tone === 'neutral'
          ? 'border-border-soft bg-muted/20'
          : cn(tint.borderSoft, tint.bgSoft),
        isDeciding && 'spin-border spin-border-info',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            state.tone === 'neutral' ? 'bg-muted' : tint.bg,
          )}
        >
          <Wand2
            size={17}
            aria-hidden
            className={state.tone === 'neutral' ? 'text-muted-foreground' : tint.icon}
          />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Eyebrow label="Orchestrator" muted />
            <OrchestratorRoutingRow
              sessionId={sessionId}
              run={run}
              disabled={busy || isOrchestrating}
            />
          </div>
          <p
            data-testid="orchestrator-state"
            className={cn(
              'flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-medium',
              state.tone === 'neutral' ? 'text-foreground' : tint.text,
            )}
          >
            {isPulsing ? (
              <StatusDot tone="info" size="sm" pulsing ariaLabel={state.sentence} />
            ) : null}
            <span className="min-w-0">{state.sentence}</span>
            {elapsed != null ? (
              <span data-testid="orchestrator-elapsed" className="tabular-nums text-2xs opacity-70">
                {elapsed}
              </span>
            ) : null}
          </p>

          {state.detail != null && state.detail !== '' ? (
            <div data-testid="orchestrator-detail" className="min-w-0">
              <Markdown text={state.detail} className="text-2xs leading-relaxed" />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5">
            {state.phase === 'ready-first' || state.phase === 'ready-mid' ? (
              <OrchestratorAction
                icon={Wand2}
                label="Decide next step"
                variant="primary"
                testId="workflow-orchestrate-next-cta"
                title="Ask the orchestrator to decide the next step"
                disabled={busy}
                onClick={() => void guard(() => orchestrateNextStep(sessionId, run.id))}
              />
            ) : null}

            {state.phase === 'needs-answer' ? (
              <OrchestratorAction
                icon={CircleHelp}
                label="Answer question"
                variant="primary"
                tone="warning"
                testId="orchestrator-answer-question"
                onClick={() => setActiveLens(sessionId, 'questions')}
              />
            ) : null}

            {state.phase === 'paused-budget' ? (
              <OrchestratorAction
                icon={Wallet}
                label="Review budget"
                variant="primary"
                tone="warning"
                testId="orchestrator-review-budget"
                onClick={() => openBudgetStudio({ scope: { kind: 'session', sessionId } })}
              />
            ) : null}

            {state.phase === 'failed' || state.phase === 'blocked' ? (
              <OrchestratorAction
                icon={RotateCcw}
                label="Retry"
                variant="primary"
                testId="orchestrator-retry"
                disabled={busy}
                onClick={() => void guard(() => retryWorkflowOrchestration(sessionId, run.id))}
              />
            ) : null}

            {state.phase === 'done' ? (
              <OrchestratorAction
                icon={Play}
                label="Keep going"
                variant="primary"
                testId="orchestrator-continue-toggle"
                expanded={continueOpen}
                disabled={busy}
                onClick={() => setContinueOpen((open) => !open)}
              />
            ) : null}

            <OrchestratorAction
              icon={PenLine}
              label={(run.orchestratorHints ?? '') === '' ? 'Add hints' : 'Hints on'}
              variant="ghost"
              testId="orchestrator-hints-toggle"
              expanded={hintsOpen}
              onClick={() => setHintsOpen((open) => !open)}
            />
          </div>

          {continueOpen ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                value={continueNote}
                onChange={(event) => setContinueNote(event.target.value)}
                rows={2}
                placeholder="What is still missing? This is handed to the orchestrator."
                data-testid="orchestrator-continue-note"
                className="w-full rounded-md border border-border-soft bg-background px-2 py-1 text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--color-focus-ring)]"
              />
              <OrchestratorAction
                icon={Play}
                label="Continue this run"
                variant="primary"
                testId="orchestrator-continue-confirm"
                disabled={busy}
                onClick={() =>
                  void guard(async () => {
                    await continueWorkflowRun(sessionId, run.id, continueNote);
                    setContinueNote('');
                    setContinueOpen(false);
                  })
                }
              />
            </div>
          ) : null}

          {hintsOpen ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                value={hintsDraft}
                onChange={(event) => setHintsDraft(event.target.value)}
                rows={3}
                placeholder="Runtime hints: what to look at, what to ignore, how to sequence."
                data-testid="orchestrator-hints-input"
                className="w-full rounded-md border border-border-soft bg-background px-2 py-1 text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--color-focus-ring)]"
              />
              <OrchestratorAction
                icon={PenLine}
                label="Save hints"
                variant="ghost"
                testId="orchestrator-hints-save"
                disabled={busy}
                onClick={() =>
                  void guard(async () => {
                    await setWorkflowOrchestratorHints(sessionId, run.id, hintsDraft);
                    setHintsOpen(false);
                  })
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      <WorkflowOrchestratorTldr steps={steps} run={run} />
    </section>
  );
};
