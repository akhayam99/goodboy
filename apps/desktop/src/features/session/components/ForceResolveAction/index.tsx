import { useEffect, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import type { Agent, SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { ResolverStatus } from '../../resolver-linkage';
import { canForceResolve } from './canForceResolve';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
};

export const ForceResolveAction = ({ agent, sessionId, status }: Props) => {
  const turnState = useAppStore((state) => state.agentTurnState[agent.id]);
  const resolveGithubThread = useAppStore((state) => state.resolveGithubThread);
  const [isArmed, setIsArmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setIsArmed(false);
    setNote('');
  }, [agent.id]);

  if (!canForceResolve({ agent, status, turnState })) {
    return null;
  }

  const onConfirm = async () => {
    if (isBusy || agent.sourceThreadId == null) {
      return;
    }
    setIsBusy(true);
    setIsArmed(false);
    const reason = note.trim();
    try {
      const didResolve = await resolveGithubThread(
        sessionId,
        agent.sourceThreadId,
        reason !== '' ? { reason } : {},
      );
      if (didResolve) {
        setNote('');
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="flex min-w-0 items-center justify-end gap-1.5"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsArmed(false);
        }
      }}
    >
      {isArmed ? (
        <input
          autoFocus
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note"
          aria-label="Resolution note"
          className="h-6 min-w-0 max-w-48 flex-1 rounded border border-border bg-background px-2 text-[10px] font-medium text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        />
      ) : null}
      <button
        type="button"
        disabled={isBusy}
        onClick={() => {
          if (isArmed) {
            void onConfirm();
            return;
          }
          setIsArmed(true);
        }}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/40 px-2 py-0.5 text-[10px] font-semibold text-warning transition-colors hover:bg-warning/10 disabled:cursor-not-allowed disabled:opacity-60',
          isBusy && 'animate-border-pulse',
        )}
      >
        <CheckCheck size={9} aria-hidden />
        {isBusy ? 'Resolving...' : isArmed ? 'Confirm resolved' : 'Mark resolved'}
      </button>
    </div>
  );
};
