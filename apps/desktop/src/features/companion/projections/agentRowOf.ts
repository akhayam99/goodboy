import type { Agent } from '@goodboy/types';
import { sendSequenceOf } from '../actions/sendSequence';
import type { AgentRow } from '../contract/projections';
import { actionIdOf } from './actionIdOf';
import { agentFactsOf } from './agentFactsOf';
import { agentMarkOf } from './agentMarkOf';
import { agentRoleOf } from './agentRoleOf';
import { agentStateOf } from './agentStateOf';
import { isLeadAgentOf } from './isLeadAgentOf';
import type { WorkspaceScope } from './workspaceScope';

const AGENT_WORDS = {
  running: 'Running',
  waiting: 'Needs you',
  stopped: 'Stopped',
  done: 'Done',
  failed: 'Failed',
} as const;

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
  readonly agent: Agent;
  readonly now: number;
};

export const agentRowOf = ({ scope, sessionId, agent, now }: Params): AgentRow => {
  const state = agentStateOf({ agent, turn: scope.turnStates[agent.id] });
  const isLead = isLeadAgentOf({ scope, sessionId, agent });
  const facts = agentFactsOf({ scope, sessionId, agent, now });
  const canStop = state === 'running';
  const canContinue = state === 'stopped';
  return {
    agentId: agent.id,
    name: agent.name,
    role: agentRoleOf({ agent, isLead }),
    isLead,
    model: facts.model,
    spendText: facts.spendText,
    timeText: facts.timeText,
    stopActionId: canStop
      ? actionIdOf({ kind: 'stopAgent', objectId: agent.id, version: state })
      : null,
    stopTreeActionId:
      isLead && canStop
        ? actionIdOf({ kind: 'stopAgentTree', objectId: agent.id, version: state })
        : null,
    continueActionId: canContinue
      ? actionIdOf({ kind: 'continueAgent', objectId: agent.id, version: state })
      : null,
    sendActionId: actionIdOf({
      kind: 'sendToAgent',
      objectId: agent.id,
      version: sendSequenceOf({ agentId: agent.id }),
    }),
    mark: agentMarkOf({ state }),
    state,
    words: AGENT_WORDS[state],
    canStop,
    canContinue,
  };
};
