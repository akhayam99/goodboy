import {
  CircleCheck,
  CircleDot,
  Copy,
  MessageSquare,
  OctagonX,
  Cpu,
  Pencil,
  ScrollText,
  Tag,
} from 'lucide-react';
import { AUTO_GATES, isAdoptableKind, parseHiddenModels, visibleCatalog } from '@goodboy/core';
import type { Agent, AgentStatus, ProviderId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { agentPlace } from '../../../store/slices/navigation/place';
import type { AgentPane } from '../../../store/slices/navigation/types';
import { SETTING_HIDDEN_MODELS } from '../../settings/settings';
import { MOVE_TO_AUTO_EVENT, moveToAutoDetail } from '../../auto/adopt/moveToAutoEvent';
import { autoMembershipOf } from '../../auto/autoMembershipOf';
import { autoRestOf, type AutoRest } from '../../auto/autoRestOf';
import { moveAutoRestingPhase } from '../../auto/moveAutoRestingPhase';
import { tauriDatabase } from '../../../shared/lib/db';
import { detachFromAuto } from '../../auto/detachFromAuto';
import { classifyAgent } from '../../session/agent-kind';
import {
  isAgentClosable,
  isAgentClosedByUser,
  isTurnStateLive,
} from '../../session/agent-lifecycle';
import { lastReplyOf } from '../../session/lastReplyOf';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import { agentObjectKey } from '../agentObjectKey';
import { RENAME_REQUEST_EVENT, requestRename } from '../renameRequest';
import { OPEN_AGENT_INTENT } from '../../../shared/utils/openAgentReveal';
import type { ActionEnv, AgentActionTarget, ObjectKindDefinition } from '../types';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';

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
  readonly isAutoOn: boolean;
  readonly canMoveToAuto: boolean;
  readonly isAdopted: boolean;
  readonly autoRest: AutoRest | null;
};

const NO_MOUNT_REASON = 'This session has no folder yet';
const WAIT_FOR_TURN_REASON = 'Wait for the turn to end first.';

type OpenAgentParams = {
  readonly env: ActionEnv;
  readonly facts: AgentFacts;
  readonly pane?: AgentPane | null;
};

const openAgent = ({ env, facts, pane = null }: OpenAgentParams) => {
  env
    .getState()
    .navigate({ to: agentPlace({ sessionId: facts.sessionId, agentId: facts.agent.id, pane }) });
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
    const session = sessionById(state.sessions, target.sessionId) ?? null;
    const turnState = state.agentTurnState[agent.id];
    const membership = autoMembershipOf({
      views: state.autoTreeViews[target.sessionId] ?? [],
      agentId: agent.id,
    });
    const kind = classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null });
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
      isAutoOn: AUTO_GATES.isDelegationEnabled,
      canMoveToAuto:
        isAdoptableKind({ kind }) &&
        agent.workflowRunId == null &&
        agent.stepId == null &&
        !membership.isMember,
      isAdopted: membership.adoption !== null,
      autoRest: autoRestOf({
        views: state.autoTreeViews[target.sessionId] ?? [],
        agentId: agent.id,
      }),
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
        env.getState().navigate({
          to: lensPlace({ state: env.getState(), sessionId: facts.sessionId, lens: 'files' }),
        }),
    },
    {
      id: 'agent.message',
      label: 'Message this agent',
      icon: MessageSquare,
      group: 'act',
      when: ({ facts }) => !facts.isClosedByUser && !facts.isAdopted,
      run: ({ facts, env }) => {
        openAgent({ env, facts, pane: 'transcript' });
        dispatchAfterNavigation({
          name: 'goodboy:reveal-chat',
          detail: { intent: OPEN_AGENT_INTENT },
        });
      },
    },
    {
      id: 'agent.rename',
      label: 'Rename',
      icon: Pencil,
      group: 'act',
      when: ({ facts }) => !facts.isWorkflowStep,
      run: ({ facts, env }) => {
        const objectKey = agentObjectKey({ agentId: facts.agent.id });
        if (requestRename({ objectKey, anchorKey: env.anchorKey })) {
          return;
        }
        openAgent({ env, facts });
        dispatchAfterNavigation({
          name: RENAME_REQUEST_EVENT,
          detail: { objectKey, anchorKey: `agent-header:${facts.agent.id}` },
        });
      },
    },
    {
      id: 'agent.transcript',
      label: 'View transcript',
      icon: ScrollText,
      group: 'open',
      when: ({ facts }) => classifyAgent({ agent: facts.agent, override: null }) === 'auto',
      run: ({ facts, env }) => {
        openAgent({ env, facts });
        env.getState().openDrawer({
          kind: 'transcript',
          sessionId: facts.sessionId,
          payload: { agentId: facts.agent.id },
        });
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
        env.getState().undoable({
          showToast: env.showToast,
          title: `${facts.name} closed`,
          message: 'It stops waiting on you. Reopen it any time.',
          undo: async () => {
            await env.getState().clearAgentDone(facts.sessionId, facts.agent.id);
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
      id: 'agent.moveToAuto',
      label: 'Move to Auto',
      icon: CONCEPT_ICONS.auto,
      group: 'act',
      description: () => 'Auto takes over this work and decides what comes next',
      when: ({ facts }) => facts.isAutoOn && facts.canMoveToAuto,
      blockedReason: ({ facts }) => (facts.isTurnLive ? WAIT_FOR_TURN_REASON : null),
      run: ({ facts, env }) => {
        openAgent({ env, facts, pane: 'transcript' });
        dispatchAfterNavigation({
          name: MOVE_TO_AUTO_EVENT,
          detail: moveToAutoDetail({ agentId: facts.agent.id }),
        });
      },
    },
    {
      id: 'agent.detachFromAuto',
      label: 'Detach from Auto',
      icon: CONCEPT_ICONS.auto,
      group: 'act',
      description: () => 'Takes this agent back from Auto',
      when: ({ facts }) => facts.isAdopted,
      blockedReason: ({ facts }) => (facts.isTurnLive ? WAIT_FOR_TURN_REASON : null),
      run: async ({ facts, env }) => {
        const outcome = await detachFromAuto({
          getState: env.getState,
          sessionId: facts.sessionId,
          agentId: facts.agent.id,
        });
        if (outcome.kind === 'detached') {
          env.showToast({ kind: 'success', message: `${facts.name} is back in your hands.` });
          return 'done';
        }
        await env.getState().reportError({
          title: "Couldn't detach from Auto",
          error: new Error(outcome.message),
          sessionId: facts.sessionId,
        });
        return 'unchanged';
      },
    },
    {
      id: 'agent.markAutoFinished',
      label: 'Mark finished',
      icon: CircleCheck,
      group: 'act',
      isUndoable: true,
      description: () => 'Closes this Auto conversation. Write to reopen it.',
      when: ({ facts }) => facts.autoRest !== null && facts.autoRest.phase !== 'finished',
      run: async ({ facts, env }) => {
        const rest = facts.autoRest;
        if (rest === null || rest.phase === 'finished') {
          return 'unchanged';
        }
        const from = rest.phase;
        try {
          await moveAutoRestingPhase({
            db: tauriDatabase,
            treeId: rest.treeId,
            from,
            to: 'finished',
            nowMs: Date.now(),
          });
        } catch (error) {
          await env.getState().reportError({
            title: "Couldn't mark Auto finished",
            error,
            sessionId: facts.sessionId,
          });
          return 'unchanged';
        }
        await env.getState().loadAutoTrees({ sessionId: facts.sessionId });
        env.getState().undoable({
          showToast: env.showToast,
          title: 'Auto finished',
          message: 'Write to Auto to reopen it.',
          undo: async () => {
            await moveAutoRestingPhase({
              db: tauriDatabase,
              treeId: rest.treeId,
              from: 'finished',
              to: from,
              nowMs: Date.now(),
            });
            await env.getState().loadAutoTrees({ sessionId: facts.sessionId });
          },
        });
        return 'done';
      },
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
