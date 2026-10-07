import { Band } from '@goodboy/ui';
import type { Agent, PlanId, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { useFollowToast } from '../../../../shared/hooks/useFollowToast';
import type { AgentKind, AgentKindRouting } from '../../agent-kind';
import { AGENT_KIND_META } from '../../agent-kind';
import { agentFollowUpMoves, composeFollowUpSeed } from '../../followUpMoves';
import type { FollowUpChild } from './followUpChildren';
import { AgentFollowUpChild } from './AgentFollowUpChild';
import { routingShortText } from '../../../../shared/components/RoutingPicker/routingSummary';
import { AgentFollowUpMove } from './AgentFollowUpMove';

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
  const followAgent = useFollowToast();

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

  const onSpawn = (nextKind: AgentKind, routing: AgentKindRouting) => {
    const planDriven = nextKind === 'implementer' && activePlanId != null;
    void (async () => {
      const agentId = await spawnAgent(sessionId, {
        kindOverride: nextKind,
        ...routing,
        ...(planDriven
          ? { triggeredPlanId: activePlanId }
          : { initialPrompt: composeFollowUpSeed({ sourceAgent, summary }) }),
        parentAgentId: sourceAgent.id,
        focus: 'agent',
      });
      followAgent({
        title: `${AGENT_KIND_META[nextKind].label} started`,
        message: `Picking up where ${sourceAgent.name} left off. Runs on ${routingShortText(routing)}.`,
        target: { place: agentPlace({ sessionId, agentId }) },
        startKey: agentId,
      });
    })();
  };

  return (
    <Band
      inset="content"
      label="Continue"
      hint={
        pending.length > 0
          ? "Start a follow-up seeded with this agent's output."
          : "Follow-ups already picked up this agent's output."
      }
    >
      <div className="flex flex-col gap-2">
        {followUps.map((entry) => (
          <AgentFollowUpChild key={entry.child.agent.id} entry={entry} sessionId={sessionId} />
        ))}
        {pending.map((move) => (
          <AgentFollowUpMove
            key={move.kind}
            sessionId={sessionId}
            kind={move.kind}
            label={move.label}
            hint={move.hint}
            onSpawn={(routing) => onSpawn(move.kind, routing)}
          />
        ))}
      </div>
    </Band>
  );
};
