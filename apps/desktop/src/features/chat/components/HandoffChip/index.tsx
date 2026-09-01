import { useMemo, useRef, useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { AgentId, AgentStatus, PlanId, SessionId } from '@goodboy/types';
import { extractHandoff } from '@goodboy/core';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { AGENT_KIND_META } from '../../../session/agent-kind';
import { AgentStatusIcon } from '../../../session/components/AgentCard/AgentStatusIcon';
import { TranscriptShell } from '../TranscriptShell';
import { useAgentStartedToast } from '../../../../shared/hooks/useAgentStartedToast';
import { selectSpawnedChildren } from '../../../../shared/utils/spawnedChildren';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly sourceAgentId: AgentId | null;
};

const TERMINAL_LABELS: Partial<Record<AgentStatus, string>> = {
  completed: 'done',
  failed: 'failed',
  skipped: 'skipped',
};

export const HandoffChip = ({ assistantText, sessionId, sourceAgentId }: Props) => {
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);
  const handoff = useMemo(() => extractHandoff(assistantText), [assistantText]);
  const session = useAppStore((s) => s.sessions.find((x) => x.id === sessionId) ?? null);
  const sessionNudge = useAppStore((s) => s.sessionNudges[sessionId] ?? null);
  const runs = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const turnStates = useAppStore((s) => s.agentTurnState);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const acceptHandoff = useAppStore((s) => s.acceptSessionNudgeHandoff);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const announceAgentStarted = useAgentStartedToast();
  const spawnedChildren = useMemo(
    () => selectSpawnedChildren({ runs, parentAgentId: sourceAgentId, turnStates }),
    [runs, sourceAgentId, turnStates],
  );
  const spawnedChild =
    handoff == null
      ? null
      : (spawnedChildren.find((child) => child.agent.kind === handoff.kind) ?? null);

  if (handoff == null || session == null || sourceAgentId == null) {
    return null;
  }
  if (session.workflowRuns.length > 0) {
    return null;
  }

  const meta = AGENT_KIND_META[handoff.kind];
  const isActiveNudge =
    sessionNudge?.kind === 'handoff-suggested' &&
    sessionNudge.agentId === sourceAgentId &&
    sessionNudge.targetKind === handoff.kind;

  const onSpawn = () => {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setIsPending(true);
    void (async () => {
      try {
        const agentId = isActiveNudge
          ? await acceptHandoff(sessionId)
          : await spawnAgent(sessionId, {
              kindOverride: handoff.kind,
              ...(handoff.planId != null ? { triggeredPlanId: handoff.planId as PlanId } : {}),
              parentAgentId: sourceAgentId,
              focus: 'none',
            });
        announceAgentStarted({
          sessionId,
          agentId,
          title: `${meta.label} started`,
          message: 'The agent is picking this up. You can keep working.',
        });
      } catch {
        pendingRef.current = false;
        setIsPending(false);
      }
    })();
  };

  const onOpen = () => {
    if (spawnedChild == null) {
      return;
    }
    void (async () => {
      await setCurrentSession(sessionId);
      setActiveLens(sessionId, 'agents');
      await selectAgent(sessionId, spawnedChild.agent.id);
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    })();
  };

  const statusLabel =
    spawnedChild == null ? null : (TERMINAL_LABELS[spawnedChild.status] ?? spawnedChild.status);

  return (
    <TranscriptShell
      data-testid="handoff-card"
      tone="neutral"
      variant="leftBorder"
      className="flex w-full max-w-xl flex-col gap-1.5 text-xs"
    >
      <span className="font-medium text-foreground">spawn {handoff.kind}</span>
      {handoff.reason != null && handoff.reason.length > 0 ? (
        <span className="text-muted-foreground">{handoff.reason}</span>
      ) : null}
      <div className="flex min-h-5 items-center gap-1.5">
        {spawnedChild == null ? (
          <button
            type="button"
            disabled={isPending}
            onClick={onSpawn}
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium text-muted-foreground',
              'hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {isPending ? (
              <LoaderCircle size={10} className="animate-spin" aria-hidden />
            ) : (
              <ArrowRight size={10} aria-hidden />
            )}
            <span>{isPending ? `Spawning ${handoff.kind}` : `Spawn ${handoff.kind}`}</span>
          </button>
        ) : (
          <>
            <AgentStatusIcon status={spawnedChild.status} />
            <span className="text-2xs text-muted-foreground">{statusLabel}</span>
            <button
              type="button"
              onClick={onOpen}
              className={cn(
                'rounded px-1.5 py-0.5 text-2xs font-medium text-muted-foreground',
                'hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]',
              )}
            >
              Go to chat
            </button>
          </>
        )}
      </div>
    </TranscriptShell>
  );
};
