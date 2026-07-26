import { useEffect, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ConfirmableButton } from '../../../../shared/components/ConfirmableButton';
import type { ResolverStatus } from '../../resolver-linkage';
import { canForceResolve } from './canForceResolve';
import { agentThreadIds } from '../../agentThreadIds';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
};

export const ForceResolveAction = ({ agent, sessionId, status }: Props) => {
  const turnState = useAppStore((state) => state.agentTurnState[agent.id]);
  const resolveGithubThread = useAppStore((state) => state.resolveGithubThread);
  const [note, setNote] = useState('');

  useEffect(() => {
    setNote('');
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
  };

  return (
    <div
      className="flex min-w-0 items-center justify-end gap-1.5"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <input
        type="text"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note"
        aria-label="Resolution note"
        className="h-6 min-w-0 max-w-48 flex-1 rounded border border-border bg-background px-2 text-[10px] font-medium text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      />
      <ConfirmableButton
        key={agent.id}
        label="Mark resolved"
        armedLabel="Confirm resolved"
        busyLabel="Resolving..."
        onConfirm={onConfirm}
        icon={<CheckCheck size={9} aria-hidden />}
      />
    </div>
  );
};
