import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@kay-am/ui';
import { evaluateSpawnReadiness, type NextAction, type SpawnReadiness } from '@kay-am/core';
import type { SessionId, Task, TaskId, TurnState } from '@kay-am/types';
import { formatError } from '../errors';
import {
  useAppStore,
  useSessionNextActions,
  useSessionSlots,
  useSummarizerStatus,
} from '../store';
import { AGENT_KIND_DEFAULTS, AGENT_KIND_PALETTE } from '../agent-kind';
import { spawnKindForAction } from '../spawn-from-next-action';

export interface NextActionChipsProps {
  readonly taskId: TaskId;
  readonly workflowBound: boolean;
  readonly className?: string;
}

const STREAMING_KINDS: ReadonlySet<TurnState['kind']> = new Set(['starting', 'running']);

function isSpawnAction(action: NextAction): boolean {
  return spawnKindForAction(action) !== null;
}

type InFlightReason = 'streaming' | 'summarizing';

type PendingAction =
  | { readonly kind: 'open_questions'; readonly action: NextAction }
  | {
      readonly kind: 'confirm_in_flight';
      readonly action: NextAction;
      readonly reason: InFlightReason;
    };

export function NextActionChips({ taskId, workflowBound, className }: NextActionChipsProps) {
  const actions = useSessionNextActions(taskId);
  const slots = useSessionSlots(taskId);
  const summarizerStatus = useSummarizerStatus(taskId);
  const session = useAppStore(
    (s): Task | null => s.sessions.find((x) => x.id === taskId) ?? null,
  );
  const selectedAgentId = useAppStore(
    (s): SessionId | null => s.selectedAgentId[taskId] ?? null,
  );
  const selectedAgentState = useAppStore((s): TurnState | null =>
    selectedAgentId ? (s.agentTurnState[selectedAgentId] ?? null) : null,
  );
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const createPrForSession = useAppStore((s) => s.createPrForSession);
  const clearSessionNextActions = useAppStore((s) => s.clearSessionNextActions);
  const [busyId, setBusyId] = useState<NextAction['id'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const hasOpenQuestions =
    (slots.find((s) => s.key === 'open_questions')?.value?.trim().length ?? 0) > 0;

  if (workflowBound || actions.length === 0) return null;

  const turnKind: TurnState['kind'] | null =
    selectedAgentState?.kind ?? session?.state.kind ?? null;
  const streaming = turnKind !== null && STREAMING_KINDS.has(turnKind);
  const summarizing = summarizerStatus.status === 'running';

  const executeAction = async (action: NextAction) => {
    setBusyId(action.id);
    setError(null);
    setPending(null);
    try {
      const kind = spawnKindForAction(action);
      if (kind) {
        const defaults = AGENT_KIND_DEFAULTS[kind];
        await spawnAgent(taskId, {
          name: action.label,
          model: defaults.model,
          effort: defaults.effort,
        });
      } else if (action.id === 'open_pr') {
        await createPrForSession(taskId);
      }
      clearSessionNextActions(taskId);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusyId(null);
    }
  };

  const onClick = async (action: NextAction) => {
    if (busyId) return;
    if (hasOpenQuestions && isSpawnAction(action)) {
      setPending({ kind: 'open_questions', action });
      return;
    }
    if (isSpawnAction(action)) {
      const readiness: SpawnReadiness = evaluateSpawnReadiness({ streaming, summarizing });
      if (readiness.kind === 'confirm') {
        setPending({ kind: 'confirm_in_flight', action, reason: readiness.reason });
        return;
      }
    }
    await executeAction(action);
  };

  return (
    <section
      className={cn('flex flex-col gap-1.5', className)}
      data-testid="next-action-chips"
      aria-label="suggested next actions"
    >
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        next
      </span>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Chip
            key={action.id}
            action={action}
            busy={busyId === action.id}
            disabled={busyId !== null && busyId !== action.id}
            onClick={() => void onClick(action)}
          />
        ))}
      </div>
      {pending?.kind === 'open_questions' ? (
        <div
          className="rounded border border-warning/50 bg-warning/10 px-2.5 py-2 text-[11px]"
          role="alertdialog"
          aria-label="open questions warning"
        >
          <p className="mb-2 font-medium text-foreground">
            open questions need resolution before spawning an agent.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground hover:opacity-90"
            >
              resolve first
            </button>
            <button
              type="button"
              onClick={() => void executeAction(pending.action)}
              className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted"
            >
              force spawn
            </button>
          </div>
        </div>
      ) : null}
      {pending?.kind === 'confirm_in_flight' ? (
        <div
          className="rounded border border-warning/50 bg-warning/10 px-2.5 py-2 text-[11px]"
          role="alertdialog"
          aria-label="work in progress warning"
          data-testid="next-action-confirm-in-flight"
        >
          <p className="mb-2 font-medium text-foreground">
            {pending.reason === 'summarizing'
              ? 'summary still running. spawn anyway?'
              : 'current turn still streaming. spawn anyway?'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              data-testid="next-action-confirm-cancel"
              className="rounded bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground hover:opacity-90"
            >
              cancel
            </button>
            <button
              type="button"
              onClick={() => void executeAction(pending.action)}
              data-testid="next-action-confirm-spawn"
              className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted"
            >
              spawn anyway
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="rounded border border-danger/30 bg-danger/10 px-2 py-1 text-[10px] text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Chip({
  action,
  busy,
  disabled,
  onClick,
}: {
  action: NextAction;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const kind = spawnKindForAction(action);
  const palette = kind ? AGENT_KIND_PALETTE[kind] : null;
  const defaults = kind ? AGENT_KIND_DEFAULTS[kind] : null;
  const title = defaults ? `model: ${defaults.model} · effort: ${defaults.effort}` : action.label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      data-testid={`next-action-${action.id}`}
      title={title}
      aria-label={action.label}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      <span>{action.label}</span>
      {palette ? (
        <span
          className={cn(
            'rounded px-1 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide',
            palette.bg,
            palette.fg,
          )}
          aria-hidden
        >
          {palette.label}
        </span>
      ) : null}
      <ArrowRight
        size={11}
        aria-hidden
        className="transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}
