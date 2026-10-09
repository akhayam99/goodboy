import { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { AgentId, PlanId, ProviderId, SessionId, TurnState } from '@goodboy/types';
import { clampEffortForModel, extractHandoff, getDefaultTurnModel } from '@goodboy/core';
import { EMPTY_ARRAY, agentPlace, useAppStore } from '../../../../store';
import {
  AGENT_KIND_META,
  KIND_TO_ROLE,
  ROLE_LABEL,
  type AgentKindRouting,
} from '../../../session/agent-kind';
import { agentStatusWord } from '../../../session/agentStatusWord';
import { selectKindRouting } from '../../../../store/slices/agents/selectKindRouting';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { composeHandoffSeed } from '../../utils/composeHandoffSeed';
import { AgentStatusIcon } from '../../../session/components/AgentCard/AgentStatusIcon';
import { TranscriptShell } from '../TranscriptShell';
import { useFollowToast } from '../../../../shared/hooks/useFollowToast';
import { selectSpawnedChildren } from '../../../../shared/utils/spawnedChildren';
import { hasActiveWorkflowRun } from '../../../workflows/activeWorkflowRuns';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly sourceAgentId: AgentId | null;
};

export const HandoffChip = ({ assistantText, sessionId, sourceAgentId }: Props) => {
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);
  const handoff = useMemo(() => extractHandoff(assistantText), [assistantText]);
  const session = useAppStore((s) => sessionById(s.sessions, sessionId) ?? null);
  const sessionNudge = useAppStore((s) => s.sessionNudges[sessionId] ?? null);
  const runs = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const turnStates = useAppStore(
    useShallow((s) => {
      const states: Record<string, TurnState> = {};
      for (const run of runs) {
        const turn = s.agentTurnState[run.id];
        if (turn === undefined) {
          continue;
        }
        states[run.id] = turn;
      }
      return states;
    }),
  );
  const defaultRouting = useAppStore(
    useShallow((s) =>
      handoff == null ? null : selectKindRouting({ state: s, sessionId, kind: handoff.kind }),
    ),
  );
  const sourceName = useAppStore((s) =>
    sourceAgentId == null
      ? null
      : ((s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).find((run) => run.id === sourceAgentId)
          ?.name ?? null),
  );
  const connectedProviders = useAppStore(
    useShallow((s) =>
      s.providers.filter((provider) => provider.connection === 'connected').map(({ id }) => id),
    ),
  );
  const [pickedRouting, setPickedRouting] = useState<AgentKindRouting | null>(null);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const acceptHandoff = useAppStore((s) => s.acceptSessionNudgeHandoff);
  const navigate = useAppStore((s) => s.navigate);
  const followAgent = useFollowToast();
  const spawnedChildren = useMemo(
    () => selectSpawnedChildren({ runs, parentAgentId: sourceAgentId, turnStates }),
    [runs, sourceAgentId, turnStates],
  );
  const spawnedChild =
    handoff == null
      ? null
      : (spawnedChildren.find((child) => child.agent.kind === handoff.kind) ?? null);

  if (handoff == null || session == null || sourceAgentId == null || defaultRouting == null) {
    return null;
  }
  if (hasActiveWorkflowRun({ workflowRuns: session.workflowRuns, agents: runs })) {
    return null;
  }

  const meta = AGENT_KIND_META[handoff.kind];
  const roleLabel = ROLE_LABEL[KIND_TO_ROLE[handoff.kind]];
  const isActiveNudge =
    sessionNudge?.kind === 'handoff-suggested' &&
    sessionNudge.agentId === sourceAgentId &&
    sessionNudge.targetKind === handoff.kind;
  const routing = pickedRouting ?? defaultRouting;

  const onProvider = (provider: ProviderId | '') => {
    if (provider === '') {
      return;
    }
    const model = getDefaultTurnModel({ id: provider });
    setPickedRouting({
      provider,
      model,
      effort: clampEffortForModel({ model, effort: routing.effort, provider }) ?? routing.effort,
    });
  };

  const onSpawn = () => {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setIsPending(true);
    void (async () => {
      try {
        const seedPrompt = composeHandoffSeed({
          sourceName: sourceName ?? 'the previous agent',
          reason: handoff.reason,
          output: assistantText,
        });
        const agentId = isActiveNudge
          ? await acceptHandoff({ sessionId, routing, seedPrompt })
          : await spawnAgent(sessionId, {
              kindOverride: handoff.kind,
              ...(handoff.planId != null ? { triggeredPlanId: handoff.planId as PlanId } : {}),
              parentAgentId: sourceAgentId,
              focus: 'none',
              seedPrompt,
              provider: routing.provider,
              model: routing.model,
              effort: routing.effort,
            });
        if (agentId == null) {
          pendingRef.current = false;
          setIsPending(false);
          return;
        }
        followAgent({
          title: `${meta.label} started`,
          target: { place: agentPlace({ sessionId, agentId }) },
          startKey: agentId,
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
    navigate({ to: agentPlace({ sessionId, agentId: spawnedChild.agent.id }) });
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  const statusLabel =
    spawnedChild == null ? null : agentStatusWord({ status: spawnedChild.status });

  return (
    <TranscriptShell
      data-testid="handoff-card"
      tone="neutral"
      variant="leftBorder"
      className="flex w-full max-w-xl flex-col gap-2 text-label"
    >
      <span className="font-medium text-foreground">{`Agent suggests: ${roleLabel}`}</span>
      {handoff.reason != null && handoff.reason.length > 0 ? (
        <span className="text-muted-foreground">{handoff.reason}</span>
      ) : null}
      <div className="flex min-h-5 items-center gap-1">
        {spawnedChild == null ? (
          <button
            type="button"
            disabled={isPending}
            onClick={onSpawn}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-chip text-muted-foreground',
              'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            <ArrowRight size={ICON_SIZE.mark} aria-hidden />
            <span className={cn(isPending && 'text-shimmer')}>
              {isPending
                ? `Starting ${roleLabel.toLowerCase()}`
                : `Start ${roleLabel.toLowerCase()}`}
            </span>
          </button>
        ) : null}
        {spawnedChild == null ? (
          <RoutingPicker
            variant="pill"
            ariaLabel={`${roleLabel} routing`}
            connectedProviders={connectedProviders}
            provider={routing.provider}
            model={routing.model}
            effort={{
              editable: true,
              value: routing.effort,
              onChange: (effort) => setPickedRouting({ ...routing, effort }),
            }}
            disabled={isPending}
            onProvider={onProvider}
            onModel={(model) =>
              setPickedRouting({
                ...routing,
                model,
                effort:
                  clampEffortForModel({
                    model,
                    effort: routing.effort,
                    provider: routing.provider,
                  }) ?? routing.effort,
              })
            }
          />
        ) : (
          <>
            <AgentStatusIcon status={spawnedChild.status} />
            <span className="text-meta text-muted-foreground">{statusLabel}</span>
            <button
              type="button"
              onClick={onOpen}
              className={cn(
                'rounded-sm px-2 py-0.5 text-chip text-muted-foreground',
                'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
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
