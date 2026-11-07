import type { ReactNode } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { effectiveAgentStatusOf } from '../../../workTreeModel/agentStateOf';
import { AgentDockChanges } from './AgentDockChanges';
import { AgentDockNext } from './AgentDockNext';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly autoDock: ReactNode;
  readonly stopped: ReactNode;
  readonly isDocked: boolean;
  readonly isRunStep: boolean;
  readonly isTreeAtRest: boolean | null;
};

export const AgentDockLead = ({
  session,
  agent,
  autoDock,
  stopped,
  isDocked,
  isRunStep,
  isTreeAtRest,
}: Props) => {
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const isTurnIdle = turnState === null || turnState.kind === 'idle';
  const isAtRest =
    isTreeAtRest ?? effectiveAgentStatusOf({ agent, turn: turnState }) === 'completed';
  const isRunOver = isDocked && !isRunStep && isAtRest && isTurnIdle;
  return (
    <>
      {autoDock}
      {isDocked ? stopped : null}
      {isRunOver ? <AgentDockChanges sessionId={session.id} agent={agent} /> : null}
      {isDocked && !isRunStep ? <AgentDockNext session={session} agent={agent} /> : null}
    </>
  );
};
