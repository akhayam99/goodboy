import { CircleCheck, CircleDot, OctagonX, Tag } from 'lucide-react';
import type { Agent, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { agentPlace } from '../../../store/slices/navigation/place';
import {
  isAgentClosable,
  isAgentClosedByUser,
  isTurnStateLive,
} from '../../session/agent-lifecycle';
import type { AgentActionTarget, ObjectKindDefinition } from './types';

export type AgentFacts = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly name: string;
  readonly isTurnRunning: boolean;
  readonly isClosable: boolean;
  readonly isClosedByUser: boolean;
};

export const AGENT_KIND: ObjectKindDefinition<AgentActionTarget, AgentFacts> = {
  noun: 'agent',
  facts: ({ state, target }) => {
    const agent =
      (state.sessionPhaseRuns[target.sessionId] ?? []).find(
        (candidate) => candidate.id === target.agentId,
      ) ?? null;
    if (agent === null || agent.deletedAt != null) {
      return null;
    }
    const turnState = state.agentTurnState[agent.id];
    const isTurnLive = isTurnStateLive({ turnState });
    const hasOpenQuestion = (state.sessionOpenQuestions[target.sessionId] ?? []).some(
      (question) => question.status === 'open' && question.createdByAgentId === agent.id,
    );
    return {
      agent,
      sessionId: target.sessionId,
      name: agent.name,
      isTurnRunning: turnState?.kind === 'running',
      isClosable: isAgentClosable({ agent, hasOpenQuestion, isTurnLive }),
      isClosedByUser: isAgentClosedByUser({ agent }),
    };
  },
  actions: [
    {
      id: 'agent.open',
      label: 'Open agent',
      icon: CONCEPT_ICONS.agents,
      group: 'open',
      when: () => true,
      run: ({ facts, env }) =>
        env
          .getState()
          .navigate({ to: agentPlace({ sessionId: facts.sessionId, agentId: facts.agent.id }) }),
    },
    {
      id: 'agent.interrupt',
      label: 'Interrupt',
      icon: OctagonX,
      group: 'act',
      when: ({ facts }) => facts.isTurnRunning,
      run: ({ facts, env }) =>
        env.getState().cancelCurrentTurn(facts.sessionId, facts.agent.id, 'user'),
    },
    {
      id: 'agent.close',
      label: 'Close',
      icon: CircleCheck,
      group: 'act',
      isUndoable: true,
      when: ({ facts }) => facts.isClosable,
      run: ({ facts, env }) => env.getState().setAgentDone(facts.sessionId, facts.agent.id),
    },
    {
      id: 'agent.reopen',
      label: 'Reopen',
      icon: CircleDot,
      group: 'act',
      when: ({ facts }) => facts.isClosedByUser,
      run: ({ facts, env }) => env.getState().clearAgentDone(facts.sessionId, facts.agent.id),
    },
    {
      id: 'agent.copyName',
      label: 'Copy name',
      icon: Tag,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.name }),
    },
    {
      id: 'agent.delete',
      label: 'Delete agent',
      icon: CONCEPT_ICONS.delete,
      group: 'danger',
      when: () => true,
      confirm: () => ({
        title: 'Delete agent?',
        description: 'Removes this agent and its transcript from the session.',
        confirmLabel: 'Delete',
        role: 'danger',
      }),
      run: ({ facts, env }) => env.getState().deleteAgent(facts.sessionId, facts.agent.id),
    },
  ],
};
