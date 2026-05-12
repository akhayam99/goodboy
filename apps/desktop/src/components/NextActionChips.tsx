import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { NextAction } from '@kay-am/core';
import type { TaskId } from '@kay-am/types';
import { useAppStore, useSessionNextActions, useSessionSlots } from '../store';
import { AGENT_KIND_DEFAULTS, AGENT_KIND_PALETTE } from '../agentKind';
import { spawnKindForAction } from '../spawnFromNextAction';

export interface NextActionChipsProps {
  readonly taskId: TaskId;
  readonly workflowBound: boolean;
  readonly className?: string;
}

function isSpawnAction(action: NextAction): boolean {
  return (
    action.id === 'spawn_planner' ||
    action.id === 'spawn_implementer' ||
    action.id === 'spawn_debugger'
  );
}

export function NextActionChips({ taskId, workflowBound, className }: NextActionChipsProps) {
  const actions = useSessionNextActions(taskId);
  const slots = useSessionSlots(taskId);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const createPrForSession = useAppStore((s) => s.createPrForSession);
  const clearSessionNextActions = useAppStore((s) => s.clearSessionNextActions);
  const [busyId, setBusyId] = useState<NextAction['id'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<NextAction | null>(null);

  const hasOpenQuestions =
    (slots.find((s) => s.key === 'open_questions')?.value?.trim().length ?? 0) > 0;

  if (workflowBound || actions.length === 0) return null;

  const executeAction = async (action: NextAction) => {
    setBusyId(action.id);
    setError(null);
    setPendingAction(null);
    try {
      switch (action.id) {
        case 'spawn_planner':
        case 'spawn_implementer':
        case 'spawn_debugger': {
          const defaults = AGENT_KIND_DEFAULTS[action.kind];
          await spawnAgent(taskId, {
            name: action.label,
            model: defaults.model,
            effort: defaults.effort,
          });
          break;
        }
        case 'open_pr':
          await createPrForSession(taskId);
          break;
        case 'merge_pr':
          // TODO (#425 follow-up): no merge action exists in the store yet.
          // The chip stays a no-op so the user sees no failure.
          break;
      }
      clearSessionNextActions(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const onClick = async (action: NextAction) => {
    if (busyId) return;
    if (hasOpenQuestions && isSpawnAction(action)) {
      setPendingAction(action);
      return;
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
      {pendingAction ? (
        <div className="rounded border border-warning/50 bg-warning/10 px-2.5 py-2 text-[11px]">
          <p className="mb-2 font-medium text-foreground">
            open questions need resolution before spawning an agent.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              className="rounded bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground hover:opacity-90"
            >
              resolve first
            </button>
            <button
              type="button"
              onClick={() => void executeAction(pendingAction)}
              className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted"
            >
              force spawn
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
