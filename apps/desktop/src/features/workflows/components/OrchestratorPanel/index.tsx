import { useState } from 'react';
import {
  CircleHelp,
  Eraser,
  PenLine,
  Play,
  RotateCcw,
  SkipForward,
  Wallet,
  Wand2,
} from 'lucide-react';
import { Eyebrow, Markdown, StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { Agent, OpenQuestion, SessionId, Step, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { workflowRunHasOpenQuestions } from '../../../context/openQuestionsGate';
import { openBudgetStudio } from '../../../budget/openBudgetStudio';
import { WorkflowOrchestratorTldr } from '../WorkflowOrchestratorTldr';
import { OrchestratorAction } from './OrchestratorAction';
import { OrchestratorDrawer } from './OrchestratorDrawer';
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
  const skipStuckStepAndAdvance = useAppStore((state) => state.skipStuckStepAndAdvance);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const openQuestions = useAppStore(
    (state) => state.sessionOpenQuestions[sessionId] ?? EMPTY_QUESTIONS,
  );
  const [openDrawer, setOpenDrawer] = useState<'none' | 'continue' | 'hints'>('none');
  const [hintsDraft, setHintsDraft] = useState(run.orchestratorHints ?? '');
  const [continueNote, setContinueNote] = useState('');
  const [busy, setBusy] = useState(false);
  const savedHints = run.orchestratorHints ?? '';
  const continueOpen = openDrawer === 'continue';
  const hintsOpen = openDrawer === 'hints';
  const hasNote = continueNote.trim() !== '';

  const toggleDrawer = (drawer: 'continue' | 'hints') =>
    setOpenDrawer((current) => (current === drawer ? 'none' : drawer));

  const state = resolveOrchestratorState({
    run,
    agents,
    isOrchestrating,
    hasOpenQuestions: workflowRunHasOpenQuestions(openQuestions, run.id),
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

            {state.phase === 'step-failed' ? (
              <OrchestratorAction
                icon={SkipForward}
                label="Skip the failed step"
                variant="primary"
                tone="danger"
                testId="orchestrator-skip-failed-step"
                title="Mark the failed step skipped and ask the orchestrator what comes next"
                disabled={busy}
                onClick={() => void guard(() => skipStuckStepAndAdvance(sessionId, run.id))}
              />
            ) : null}

            {state.phase === 'stopped' ? (
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
                label="Continue the run"
                variant="primary"
                testId="orchestrator-continue-toggle"
                title="Continue this run, with or without a note about what is missing"
                expanded={continueOpen}
                disabled={busy}
                onClick={() => toggleDrawer('continue')}
              />
            ) : null}

            <OrchestratorAction
              icon={PenLine}
              label={savedHints === '' ? 'Standing hints' : 'Standing hints on'}
              variant="ghost"
              testId="orchestrator-hints-toggle"
              title="Notes the orchestrator reads before every step it decides"
              expanded={hintsOpen}
              onClick={() => toggleDrawer('hints')}
            />
          </div>

          {continueOpen ? (
            <OrchestratorDrawer
              inputId="orchestrator-continue-note-field"
              title="Not done? Say what is missing"
              help="Optional. Leave it empty and the orchestrator decides what comes next. What you write stays on the decision it triggers."
            >
              <textarea
                id="orchestrator-continue-note-field"
                value={continueNote}
                onChange={(event) => setContinueNote(event.target.value)}
                rows={2}
                placeholder="e.g. the gate is in place but its tests are missing"
                data-testid="orchestrator-continue-note"
                className="w-full rounded-md border border-border-soft bg-background px-2 py-1 text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--color-focus-ring)]"
              />
              <OrchestratorAction
                icon={Play}
                label={hasNote ? 'Continue with this note' : 'Continue, you decide'}
                variant="primary"
                testId="orchestrator-continue-confirm"
                disabled={busy}
                onClick={() =>
                  void guard(async () => {
                    await continueWorkflowRun(sessionId, run.id, continueNote);
                    setContinueNote('');
                    setOpenDrawer('none');
                  })
                }
              />
            </OrchestratorDrawer>
          ) : null}

          {hintsOpen ? (
            <OrchestratorDrawer
              inputId="orchestrator-hints-field"
              title="Standing hints for every step"
              help="The orchestrator reads these before each step it decides, until you clear them."
            >
              <textarea
                id="orchestrator-hints-field"
                value={hintsDraft}
                onChange={(event) => setHintsDraft(event.target.value)}
                rows={3}
                placeholder="e.g. open a PR and push a single commit, use the project skill"
                data-testid="orchestrator-hints-input"
                className="w-full rounded-md border border-border-soft bg-background px-2 py-1 text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--color-focus-ring)]"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <OrchestratorAction
                  icon={PenLine}
                  label="Save hints"
                  variant="primary"
                  testId="orchestrator-hints-save"
                  disabled={busy}
                  onClick={() =>
                    void guard(async () => {
                      await setWorkflowOrchestratorHints(sessionId, run.id, hintsDraft);
                      setOpenDrawer('none');
                    })
                  }
                />
                {savedHints === '' ? null : (
                  <OrchestratorAction
                    icon={Eraser}
                    label="Clear hints"
                    variant="ghost"
                    testId="orchestrator-hints-clear"
                    disabled={busy}
                    onClick={() =>
                      void guard(async () => {
                        await setWorkflowOrchestratorHints(sessionId, run.id, '');
                        setHintsDraft('');
                        setOpenDrawer('none');
                      })
                    }
                  />
                )}
              </div>
            </OrchestratorDrawer>
          ) : null}
        </div>
      </div>

      <WorkflowOrchestratorTldr steps={steps} run={run} />
    </section>
  );
};
