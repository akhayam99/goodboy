import { useState } from 'react';
import {
  CircleHelp,
  CircleStop,
  Eraser,
  PenLine,
  Play,
  RotateCcw,
  SkipForward,
  Users,
  Wallet,
} from 'lucide-react';
import { Eyebrow, InlineConfirm, Markdown, StatusDot, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type {
  Agent,
  BudgetAlert,
  OpenQuestion,
  SessionId,
  Step,
  WorkflowRun,
} from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { workflowRunHasOpenQuestions } from '../../../context/openQuestionsGate';
import { openBudgetStudio } from '../../../budget/openBudgetStudio';
import { isBudgetBlocked } from '../../../../store/slices/workflows/budgetBlock';
import { WorkflowAutorunToggle } from '../WorkflowAutorunToggle';
import { WorkflowOrchestratorTldr } from '../WorkflowOrchestratorTldr';
import { RunSpendLimitPopover } from '../RunSpendLimitPopover';
import { OrchestratorAction } from './OrchestratorAction';
import { OrchestratorDrawer } from './OrchestratorDrawer';
import { OrchestratorRoutingRow } from './OrchestratorRoutingRow';
import { RunRoleModels } from './RunRoleModels';
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
  const setWorkflowRunAutoRun = useAppStore((state) => state.setWorkflowRunAutoRun);
  const stopWorkflowRunNow = useAppStore((state) => state.stopWorkflowRunNow);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const openQuestions = useAppStore(
    (state) => state.sessionOpenQuestions[sessionId] ?? EMPTY_QUESTIONS,
  );
  const sessionBudgetBlocked = useAppStore((state) =>
    isBudgetBlocked({ alerts: state.budgetAlerts ?? EMPTY_ALERTS, sessionId }),
  );
  const [openDrawer, setOpenDrawer] = useState<'none' | 'continue' | 'hints' | 'roles'>('none');
  const [hintsDraft, setHintsDraft] = useState(run.orchestratorHints ?? '');
  const [continueNote, setContinueNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [isStopArmed, setIsStopArmed] = useState(false);
  const savedHints = run.orchestratorHints ?? '';
  const continueOpen = openDrawer === 'continue';
  const hintsOpen = openDrawer === 'hints';
  const rolesOpen = openDrawer === 'roles';
  const hasNote = continueNote.trim() !== '';
  const overriddenRoleCount = Object.keys(run.roleModelOverrides ?? {}).length;

  const toggleDrawer = (drawer: 'continue' | 'hints' | 'roles') =>
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
  const isPulsing =
    isDeciding ||
    state.phase === 'automatic' ||
    state.phase === 'stopping' ||
    state.phase === 'stopping-graceful';
  const pulseTone = state.tone === 'neutral' ? 'info' : state.tone;
  const isRunOver = state.phase === 'done';
  const isStepInFlight = isOrchestrating || agents.some((agent) => agent.status === 'running');

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
      case 'needs-answer':
        return (
          <OrchestratorAction
            icon={CircleHelp}
            label="Answer question"
            variant="primary"
            tone="warning"
            testId="orchestrator-answer-question"
            onClick={() => setActiveLens(sessionId, 'questions')}
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
            onClick={() => openBudgetStudio({ scope: { kind: 'session', sessionId } })}
          />
        ) : (
          <RunSpendLimitPopover sessionId={sessionId} run={run} variant="primary" />
        );
      case 'step-failed':
        return (
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
            testId="orchestrator-continue-toggle"
            title="Continue this run, with or without a note about what is missing"
            expanded={continueOpen}
            disabled={busy}
            onClick={() => toggleDrawer('continue')}
          />
        );
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
        'flex flex-col gap-1.5 rounded-lg border px-3 py-2',
        state.tone === 'neutral'
          ? 'border-border-soft bg-muted/20'
          : cn(tint.borderSoft, tint.bgSoft),
        isDeciding && 'spin-border spin-border-info',
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            state.tone === 'neutral' ? 'bg-muted' : tint.bg,
          )}
        >
          <CONCEPT_ICONS.orchestrator
            size={15}
            aria-hidden
            className={state.tone === 'neutral' ? 'text-muted-foreground' : tint.icon}
          />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Eyebrow label="Orchestrator" muted />
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
            {savedHints === '' ? null : (
              <span className="font-normal text-muted-foreground">· Standing hints on</span>
            )}
            {overriddenRoleCount === 0 ? null : (
              <span
                data-testid="orchestrator-role-models-count"
                className="font-normal text-muted-foreground"
              >
                · {overriddenRoleCount} {overriddenRoleCount === 1 ? 'role' : 'roles'} on a chosen
                model
              </span>
            )}
          </p>

          {state.detail != null && state.detail !== '' ? (
            <div data-testid="orchestrator-detail" className="min-w-0">
              <Markdown text={state.detail} className="text-2xs leading-relaxed" />
            </div>
          ) : null}
          {isStepInFlight && run.orchestrationStop?.kind !== 'operator' ? (
            <div className="relative flex">
              <button
                type="button"
                aria-expanded={isStopArmed}
                onClick={() => setIsStopArmed(true)}
                className="rounded px-1.5 text-2xs text-danger hover:bg-danger/10"
              >
                Stop now
              </button>
              {isStopArmed ? (
                <div className="absolute left-0 top-full z-popover w-72 rounded-lg bg-background shadow-lg">
                  <InlineConfirm
                    role="alert"
                    icon={<CircleStop size={12} aria-hidden />}
                    title="Stop now?"
                    description="The step in flight is cancelled and marked skipped. Everything it already wrote is kept."
                    confirmLabel="Stop now"
                    onConfirm={() => {
                      setIsStopArmed(false);
                      void stopWorkflowRunNow(sessionId, run.id);
                    }}
                    onCancel={() => setIsStopArmed(false)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {isRunOver ? null : (
            <WorkflowAutorunToggle
              variant="detail"
              isOn={run.autoRun === true}
              onToggle={() => void setWorkflowRunAutoRun(sessionId, run.id, run.autoRun !== true)}
            />
          )}
          {primaryAction}
          <OrchestratorAction
            icon={PenLine}
            label="Hints"
            variant="ghost"
            testId="orchestrator-hints-toggle"
            title={savedHints === '' ? 'Set standing hints for every step' : 'Edit standing hints'}
            expanded={hintsOpen}
            onClick={() => toggleDrawer('hints')}
          />
          <OrchestratorAction
            icon={Users}
            label="Role models"
            variant="ghost"
            testId="orchestrator-role-models-toggle"
            title="Pick the model each role uses for the rest of this run"
            expanded={rolesOpen}
            onClick={() => toggleDrawer('roles')}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <OrchestratorRoutingRow
          sessionId={sessionId}
          run={run}
          disabled={busy || isOrchestrating}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        {rolesOpen ? <RunRoleModels sessionId={sessionId} run={run} disabled={busy} /> : null}

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

      <WorkflowOrchestratorTldr steps={steps} run={run} />
    </section>
  );
};
