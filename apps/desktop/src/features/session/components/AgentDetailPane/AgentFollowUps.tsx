import { ArrowRight } from 'lucide-react';
import { SectionSurface, cn } from '@goodboy/ui';
import type { Agent, PlanId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useAgentStartedToast } from '../../../../shared/hooks/useAgentStartedToast';
import type { AgentKind } from '../../agent-kind';
import { AGENT_KIND_META } from '../../agent-kind';
import { AgentKindChip } from '../AgentKindChip';
import { agentFollowUpMoves, composeFollowUpSeed } from './followUpMoves';
import type { FollowUpChild } from './followUpChildren';
import { AgentFollowUpChild } from './AgentFollowUpChild';

type Props = {
  readonly sourceAgent: Agent;
  readonly sourceKind: AgentKind;
  readonly summary: string;
  readonly sessionId: SessionId;
  readonly followUps: ReadonlyArray<FollowUpChild>;
  readonly activePlanId: PlanId | null;
};

export const AgentFollowUps = ({
  sourceAgent,
  sourceKind,
  summary,
  sessionId,
  followUps,
  activePlanId,
}: Props) => {
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const announceAgentStarted = useAgentStartedToast();

  const moves = agentFollowUpMoves({ sourceKind });
  if (moves.length === 0) {
    return null;
  }
  if (sourceAgent.status !== 'completed') {
    return null;
  }
  if (sourceAgent.workflowRunId != null) {
    return null;
  }

  const spawnedKinds = new Set(followUps.map((entry) => entry.kind));
  const pending = moves.filter((move) => !spawnedKinds.has(move.kind));

  const onSpawn = (nextKind: AgentKind) => {
    const planDriven = nextKind === 'implementer' && activePlanId != null;
    void (async () => {
      const agentId = await spawnAgent(sessionId, {
        kindOverride: nextKind,
        ...(planDriven
          ? { triggeredPlanId: activePlanId }
          : { initialPrompt: composeFollowUpSeed({ sourceAgent, summary }) }),
        parentAgentId: sourceAgent.id,
        focus: 'agent',
      });
      announceAgentStarted({
        sessionId,
        agentId,
        title: `${AGENT_KIND_META[nextKind].label} started`,
        message: `Picking up where ${sourceAgent.name} left off.`,
      });
    })();
  };

  return (
    <SectionSurface
      label="Continue"
      hint={
        pending.length > 0
          ? "Spawn a follow-up seeded with this agent's output."
          : "Follow-ups already picked up this agent's output."
      }
    >
      <div className="flex flex-col gap-1.5">
        {followUps.map((entry) => (
          <AgentFollowUpChild key={entry.child.agent.id} entry={entry} sessionId={sessionId} />
        ))}
        {pending.map((move) => (
          <button
            key={move.kind}
            type="button"
            onClick={() => onSpawn(move.kind)}
            className={cn(
              'group flex items-center gap-2 rounded-md border border-border-soft bg-elevated px-3 py-2 text-left text-xs transition-colors hover:border-border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
            )}
          >
            <AgentKindChip kind={move.kind} title={move.label} />
            <span className="min-w-0 flex-1 text-foreground">{move.hint}</span>
            <ArrowRight
              size={12}
              aria-hidden
              className="shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
            />
          </button>
        ))}
      </div>
    </SectionSurface>
  );
};
