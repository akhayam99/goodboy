import { useEffect, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ResolverStatus } from '../../resolver-linkage';
import { canForceResolve } from './canForceResolve';
import { agentThreadIds } from '../../agentThreadIds';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
};

const NOTE_CLASS =
  'h-6 w-full min-w-0 rounded-md border border-border bg-background px-2 text-[10px] font-medium text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

export const ForceResolveAction = ({ agent, sessionId, status }: Props) => {
  const turnState = useAppStore((state) => state.agentTurnState[agent.id]);
  const resolveGithubThread = useAppStore((state) => state.resolveGithubThread);
  const [note, setNote] = useState('');
  const [isArmed, setIsArmed] = useState(false);

  useEffect(() => {
    setNote('');
    setIsArmed(false);
  }, [agent.id]);

  if (!canForceResolve({ agent, status, turnState })) {
    return null;
  }

  const onConfirm = async () => {
    const threadIds = agentThreadIds(agent);
    if (threadIds.length === 0) {
      return;
    }
    const reason = note.trim();
    const results = [];
    for (const threadId of threadIds) {
      results.push(await resolveGithubThread(sessionId, threadId, reason !== '' ? { reason } : {}));
    }
    if (results.every((didResolve) => didResolve)) {
      setNote('');
    }
    setIsArmed(false);
  };

  return (
    <div
      className="flex min-w-0 flex-col items-end gap-1.5"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {isArmed ? (
        <InlineConfirm
          role="primary"
          icon={<CheckCheck size={12} aria-hidden />}
          title="Mark thread resolved?"
          description="Resolves the review thread on GitHub without waiting for the resolver agent."
          confirmLabel="Mark resolved"
          onConfirm={onConfirm}
          onCancel={() => setIsArmed(false)}
          className="w-full"
          note={
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note"
              aria-label="Resolution note"
              className={NOTE_CLASS}
            />
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsArmed(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/40 px-2 py-0.5 text-[10px] font-semibold text-warning motion-safe:transition-colors hover:bg-warning/10"
        >
          <CheckCheck size={9} aria-hidden />
          Mark resolved
        </button>
      )}
    </div>
  );
};
