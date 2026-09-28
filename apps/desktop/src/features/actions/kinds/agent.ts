import { CircleCheck, CircleDot, Copy, MessageSquare, OctagonX, Cpu, Tag } from 'lucide-react';
import { parseHiddenModels, visibleCatalog } from '@goodboy/core';
import type { Agent, AgentStatus, ProviderId, SessionId, TurnEvent } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { agentPlace, sessionPlace } from '../../../store/slices/navigation/place';
import { SETTING_HIDDEN_MODELS } from '../../settings/settings';
import {
  isAgentClosable,
  isAgentClosedByUser,
  isTurnStateLive,
} from '../../session/agent-lifecycle';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import type { ActionEnv, AgentActionTarget, ObjectKindDefinition } from '../types';

export type AgentFacts = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly name: string;
  readonly status: AgentStatus;
  readonly isTurnLive: boolean;
  readonly isTurnRunning: boolean;
  readonly hasOpenQuestion: boolean;
  readonly isClosable: boolean;
  readonly isClosedByUser: boolean;
  readonly isWorkflowStep: boolean;
  readonly hasMount: boolean;
  readonly lastReply: string | null;
  readonly provider: ProviderId;
  readonly modelKey: string | null;
  readonly hiddenModels: string | null;
};

const NO_MOUNT_REASON = 'This session has no project yet';

const openAgent = ({ env, facts }: { readonly env: ActionEnv; readonly facts: AgentFacts }) => {
  env
    .getState()
    .navigate({ to: agentPlace({ sessionId: facts.sessionId, agentId: facts.agent.id }) });
};

const lastReplyOf = ({ events }: { readonly events: ReadonlyArray<TurnEvent> }): string | null => {
  const lastUser = events.map((event) => event.kind).lastIndexOf('user_text');
  const reply = events
    .slice(lastUser + 1)
    .flatMap((event) => (event.kind === 'assistant_text' ? [event.delta] : []))
    .join('')
    .trim();
  return reply === '' ? null : reply;
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
    const session = state.sessions.find((candidate) => candidate.id === target.sessionId) ?? null;
    const turnState = state.agentTurnState[agent.id];
    const isTurnLive = isTurnStateLive({ turnState });
    const hasOpenQuestion = (state.sessionOpenQuestions[target.sessionId] ?? []).some(
      (question) => question.status === 'open' && question.createdByAgentId === agent.id,
    );
    return {
      agent,
      sessionId: target.sessionId,
      name: agent.name,
      status: agent.status,
      isTurnLive,
      isTurnRunning: turnState?.kind === 'running',
      hasOpenQuestion,
      isClosable: isAgentClosable({ agent, hasOpenQuestion, isTurnLive }),
      isClosedByUser: isAgentClosedByUser({ agent }),
      isWorkflowStep: agent.workflowRunId != null,
      hasMount: (state.sessionProjectMounts[target.sessionId] ?? []).length > 0,
      lastReply: lastReplyOf({ events: state.transcripts[agent.id] ?? [] }),
      provider:
        state.agentProviderOverride[agent.id] ??
        agent.providerOverride ??
        session?.providerPreference.defaultProvider ??
        'anthropic',
      modelKey: state.agentModelOverride[agent.id] ?? agent.modelOverride ?? null,
      hiddenModels: state.settings?.[SETTING_HIDDEN_MODELS] ?? null,
    };
  },
  actions: [
    {
      id: 'agent.open',
      label: 'Open agent',
      icon: CONCEPT_ICONS.agents,
      group: 'open',
      when: ({ facts, viewing }) => !(viewing?.kind === 'agent' && viewing.id === facts.agent.id),
      run: ({ facts, env }) => openAgent({ env, facts }),
    },
    {
      id: 'agent.changes',
      label: 'Show its changes',
      icon: CONCEPT_ICONS.diff,
      group: 'open',
      when: () => true,
      blockedReason: ({ facts }) => (facts.hasMount ? null : NO_MOUNT_REASON),
      run: ({ facts, env }) =>
        env
          .getState()
          .navigate({ to: sessionPlace({ sessionId: facts.sessionId, lens: 'files' }) }),
    },
    {
      id: 'agent.message',
      label: 'Message this agent',
      icon: MessageSquare,
      group: 'act',
      when: ({ facts }) => !facts.isClosedByUser,
      run: ({ facts, env }) => {
        openAgent({ env, facts });
        dispatchAfterNavigation({ name: 'goodboy:reveal-chat' });
      },
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
      run: async ({ facts, env }) => {
        await env.getState().setAgentDone(facts.sessionId, facts.agent.id);
        env.showToast({
          kind: 'info',
          title: `${facts.name} closed`,
          message: 'It stops waiting on you. Reopen it any time.',
          action: {
            label: 'Undo',
            onClick: () => void env.getState().clearAgentDone(facts.sessionId, facts.agent.id),
          },
        });
      },
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
      id: 'agent.model',
      label: 'Change model',
      icon: Cpu,
      group: 'act',
      when: ({ facts }) => !facts.isWorkflowStep && !facts.isClosedByUser,
      choices: ({ facts }) =>
        visibleCatalog({
          provider: facts.provider,
          hidden: parseHiddenModels(facts.hiddenModels),
          currentKey: facts.modelKey,
        })
          .filter((model) => model.tier === 'turn')
          .map((model) => ({
            id: model.key,
            label: model.label,
            isCurrent: model.key === facts.modelKey,
          })),
      run: async ({ facts, env, choice }) => {
        if (choice === null) {
          return;
        }
        await env.getState().setAgentConfig(facts.sessionId, facts.agent.id, {
          modelOverride: choice,
        });
      },
    },
    {
      id: 'agent.copyReply',
      label: 'Copy last reply',
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.lastReply !== null,
      run: ({ facts, env }) => env.copyText({ text: facts.lastReply ?? '' }),
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
