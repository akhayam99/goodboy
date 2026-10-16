import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Band, Markdown } from '@goodboy/ui';
import type { Agent, Session, TurnState } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectSpawnedChildren } from '../../../../shared/utils/spawnedChildren';
import { isQuestionDelegate } from '../../../context/questionDelegate';
import { useAgentOutcome } from '../../../../shared/hooks/useAgentOutcome';
import { classifyAgent } from '../../agent-kind';
import { AgentFollowUps } from './AgentFollowUps';
import { DelegationLines } from './DelegationLines';
import { useAutoMembership } from '../../../auto/useAutoMembership';
import { agentFollowUpMoves } from '../../followUpMoves';
import { selectFollowUpChildren } from './followUpChildren';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
};

export const AgentConversationEnd = ({ session, agent }: Props) => {
  const runs: ReadonlyArray<Agent> = useAppStore(
    (state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY,
  );
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  const plans = useAppStore((state) => state.sessionPlans[session.id] ?? EMPTY_ARRAY);
  const turnStates = useAppStore(
    useShallow((state) => {
      const states: Record<string, TurnState> = {};
      for (const run of runs) {
        const turn = state.agentTurnState[run.id];
        if (turn === undefined) {
          continue;
        }
        states[run.id] = turn;
      }
      return states;
    }),
  );
  const children = useMemo(
    () => selectSpawnedChildren({ runs, parentAgentId: agent.id, turnStates }),
    [agent.id, runs, turnStates],
  );
  const kind = classifyAgent({ agent, override: kindOverride });
  const membership = useAutoMembership({ sessionId: session.id, agentId: agent.id });
  const followUps = useMemo(
    () =>
      selectFollowUpChildren({
        spawned: children,
        kinds: agentFollowUpMoves({ sourceKind: kind, isInAutoTree: membership.isMember }).map(
          (move) => move.kind,
        ),
      }),
    [children, kind, membership.isMember],
  );
  const delegated = useMemo(() => {
    const followUpIds = new Set(followUps.map((entry) => entry.child.agent.id));
    return children
      .filter((child) => !followUpIds.has(child.agent.id))
      .map((child) => child.agent)
      .filter((child) => kind !== 'planner' || isQuestionDelegate({ agent: child }));
  }, [children, followUps, kind]);
  const outcome = useAgentOutcome({ agent });
  const isRecordedOutcome = !outcome.isFromReply && outcome.text !== '';

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <DelegationLines sessionId={session.id} agents={delegated} />
      {isRecordedOutcome ? (
        <Band inset="content" label="Outcome" headingLevel={2}>
          <div className="text-prose text-foreground">
            <Markdown text={outcome.text} />
          </div>
        </Band>
      ) : null}
      <AgentFollowUps
        sourceAgent={agent}
        sourceKind={kind}
        summary={outcome.raw}
        sessionId={session.id}
        followUps={followUps}
        activePlanId={
          [...plans].reverse().find((plan) => plan.agentId === agent.id && plan.status === 'active')
            ?.id ?? null
        }
      />
    </div>
  );
};
