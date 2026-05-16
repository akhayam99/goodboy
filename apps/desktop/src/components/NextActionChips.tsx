import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { NextAction } from '@kay-am/core';
import type { SessionId } from '@kay-am/types';
import { formatError } from '../errors';
import { useAppStore, useSessionNextActions } from '../store';
import { AGENT_KIND_DEFAULTS, AGENT_KIND_PALETTE } from '../agent-kind';
import { spawnKindForAction } from '../spawn-from-next-action';

export interface NextActionChipsProps {
  readonly sessionId: SessionId;
  readonly workflowBound: boolean;
  readonly className?: string;
}

export function NextActionChips({ sessionId, workflowBound, className }: NextActionChipsProps) {
  const actions = useSessionNextActions(sessionId);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const clearSessionNextActions = useAppStore((s) => s.clearSessionNextActions);
  const [busyId, setBusyId] = useState<NextAction['id'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (workflowBound || actions.length === 0) return null;

  const executeAction = async (action: NextAction) => {
    setBusyId(action.id);
    setError(null);
    try {
      const kind = spawnKindForAction(action);
      const defaults = AGENT_KIND_DEFAULTS[kind];
      await spawnAgent(sessionId, {
        name: action.label,
        model: defaults.model,
        effort: defaults.effort,
        initialPrompt: action.prompt,
      });
      clearSessionNextActions(sessionId);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusyId(null);
    }
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
      <div className="flex flex-col gap-1.5">
        {actions.map((action) => (
          <Cta
            key={action.id}
            action={action}
            busy={busyId === action.id}
            disabled={busyId !== null && busyId !== action.id}
            onClick={() => void executeAction(action)}
          />
        ))}
      </div>
      {error ? (
        <p className="rounded border border-danger/30 bg-danger/10 px-2 py-1 text-[10px] text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Cta({
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
  const palette = AGENT_KIND_PALETTE[kind];
  const defaults = AGENT_KIND_DEFAULTS[kind];
  const title = `${action.prompt} · model: ${defaults.model} · effort: ${defaults.effort}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      data-testid={`next-action-${action.id}`}
      title={title}
      aria-label={action.label}
      className={cn(
        'group inline-flex w-full items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-left text-xs font-medium text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      <span className="flex items-center gap-2">
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
        <span>{action.label}</span>
      </span>
      <ArrowRight
        size={12}
        aria-hidden
        className="shrink-0 transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}
