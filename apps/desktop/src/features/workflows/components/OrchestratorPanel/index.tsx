import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Play, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { cn, Markdown, StatusDot } from '@goodboy/ui';
import type { Agent, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { OrchestratorRoutingRow } from './OrchestratorRoutingRow';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly isOrchestrating: boolean;
};

type Phase = 'deciding' | 'running' | 'idle' | 'failed' | 'blocked' | 'done';

const phaseOf = ({
  run,
  agents,
  isOrchestrating,
}: Pick<Props, 'run' | 'agents' | 'isOrchestrating'>): Phase => {
  if (isOrchestrating) return 'deciding';
  if (run.orchestrationOutcome === 'done') return 'done';
  if (run.orchestrationOutcome === 'blocked') return 'blocked';
  if (run.orchestrationError != null) return 'failed';
  if (agents.some((agent) => agent.status === 'running' || agent.status === 'pending')) {
    return 'running';
  }
  return 'idle';
};

const PHASE_COPY: Readonly<Record<Phase, string>> = {
  deciding: 'deciding the next step',
  running: 'waiting for the running step to finish',
  idle: 'idle, waiting for you to ask for the next step',
  failed: 'the last decision failed',
  blocked: 'stopped, it needs a human call',
  done: 'run complete',
};

const PHASE_TONE: Readonly<Record<Phase, string>> = {
  deciding: 'border-info/40 bg-info/5 text-info',
  running: 'border-primary/30 bg-primary/5 text-primary',
  idle: 'border-border-soft bg-muted/20 text-muted-foreground',
  failed: 'border-danger/40 bg-danger/5 text-danger',
  blocked: 'border-warning/40 bg-warning/5 text-warning',
  done: 'border-success/30 bg-success/5 text-success',
};

export const OrchestratorPanel = ({ sessionId, run, agents, isOrchestrating }: Props) => {
  const orchestrateNextStep = useAppStore((state) => state.orchestrateNextStep);
  const retryWorkflowOrchestration = useAppStore((state) => state.retryWorkflowOrchestration);
  const continueWorkflowRun = useAppStore((state) => state.continueWorkflowRun);
  const setWorkflowOrchestratorHints = useAppStore((state) => state.setWorkflowOrchestratorHints);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [hintsDraft, setHintsDraft] = useState(run.orchestratorHints ?? '');
  const [continueNote, setContinueNote] = useState('');
  const [continueOpen, setContinueOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const phase = phaseOf({ run, agents, isOrchestrating });

  const guard = async (action: () => Promise<void>) => {
    if (busy) return;
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
      className={cn('flex flex-col gap-2 rounded-lg border px-3 py-2', PHASE_TONE[phase])}
    >
      <div className="flex items-center gap-1.5 text-2xs font-semibold">
        {phase === 'deciding' ? (
          <StatusDot tone="info" size="sm" pulsing ariaLabel="Deciding" />
        ) : phase === 'done' ? (
          <CheckCircle2 size={12} aria-hidden className="shrink-0" />
        ) : phase === 'failed' || phase === 'blocked' ? (
          <AlertTriangle size={12} aria-hidden className="shrink-0" />
        ) : (
          <Sparkles size={12} aria-hidden className="shrink-0" />
        )}
        <span>Orchestrator: {PHASE_COPY[phase]}</span>
      </div>

      {run.orchestrationError != null ? (
        <div data-testid="orchestrator-error" className="min-w-0 text-danger">
          <Markdown text={run.orchestrationError} className="text-2xs leading-relaxed" />
        </div>
      ) : null}

      <OrchestratorRoutingRow sessionId={sessionId} run={run} disabled={busy || isOrchestrating} />

      <div className="flex flex-wrap items-center gap-1.5">
        {phase === 'idle' ? (
          <button
            type="button"
            disabled={busy}
            data-testid="workflow-orchestrate-next-cta"
            title="Ask the orchestrator to decide the next step"
            onClick={() => void guard(() => orchestrateNextStep(sessionId, run.id))}
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-2xs font-semibold text-primary hover:border-primary disabled:opacity-60"
          >
            <Wand2 size={11} aria-hidden />
            next step
          </button>
        ) : null}

        {phase === 'failed' || phase === 'blocked' ? (
          <button
            type="button"
            disabled={busy}
            data-testid="orchestrator-retry"
            onClick={() => void guard(() => retryWorkflowOrchestration(sessionId, run.id))}
            className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-elevated px-2 py-1 text-2xs font-semibold text-foreground hover:border-border disabled:opacity-60"
          >
            <RotateCcw size={11} aria-hidden />
            retry
          </button>
        ) : null}

        {phase === 'done' ? (
          <button
            type="button"
            disabled={busy}
            data-testid="orchestrator-continue-toggle"
            aria-expanded={continueOpen}
            onClick={() => setContinueOpen((open) => !open)}
            className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-elevated px-2 py-1 text-2xs font-semibold text-foreground hover:border-border disabled:opacity-60"
          >
            <Play size={11} aria-hidden />
            keep going
          </button>
        ) : null}

        <button
          type="button"
          data-testid="orchestrator-hints-toggle"
          aria-expanded={hintsOpen}
          onClick={() => setHintsOpen((open) => !open)}
          className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-elevated px-2 py-1 text-2xs font-semibold text-foreground hover:border-border"
        >
          {run.orchestratorHints ? 'hints (on)' : 'add hints'}
        </button>
      </div>

      {continueOpen ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={continueNote}
            onChange={(event) => setContinueNote(event.target.value)}
            rows={2}
            placeholder="what is still missing? this is handed to the orchestrator"
            data-testid="orchestrator-continue-note"
            className="w-full rounded-md border border-border-soft bg-background px-2 py-1 text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--color-focus-ring)]"
          />
          <button
            type="button"
            disabled={busy}
            data-testid="orchestrator-continue-confirm"
            onClick={() =>
              void guard(async () => {
                await continueWorkflowRun(sessionId, run.id, continueNote);
                setContinueNote('');
                setContinueOpen(false);
              })
            }
            className="w-fit rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-2xs font-semibold text-primary hover:border-primary disabled:opacity-60"
          >
            continue this run
          </button>
        </div>
      ) : null}

      {hintsOpen ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={hintsDraft}
            onChange={(event) => setHintsDraft(event.target.value)}
            rows={3}
            placeholder="runtime hints: what to look at, what to ignore, how to sequence"
            data-testid="orchestrator-hints-input"
            className="w-full rounded-md border border-border-soft bg-background px-2 py-1 text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--color-focus-ring)]"
          />
          <button
            type="button"
            disabled={busy}
            data-testid="orchestrator-hints-save"
            onClick={() =>
              void guard(async () => {
                await setWorkflowOrchestratorHints(sessionId, run.id, hintsDraft);
                setHintsOpen(false);
              })
            }
            className="w-fit rounded-md border border-border-soft bg-elevated px-2 py-1 text-2xs font-semibold text-foreground hover:border-border disabled:opacity-60"
          >
            save hints
          </button>
        </div>
      ) : null}
    </section>
  );
};
