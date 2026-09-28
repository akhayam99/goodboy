import { Copy, FileCode, Quote } from 'lucide-react';
import type { AgentId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { agentPlace } from '../../../store/slices/navigation/place';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import type { MessageActionTarget, ObjectKindDefinition } from '../types';

export type MessageFacts = {
  readonly text: string;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
  readonly hasComposer: boolean;
};

const plainText = ({ text }: { readonly text: string }): string =>
  text
    .replace(/```[^\n]*\n?/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>)\s?/gm, '')
    .replace(/(\*\*|__|`)/g, '')
    .trim();

const quoted = ({ text }: { readonly text: string }): string =>
  text
    .trim()
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

export const MESSAGE_KIND: ObjectKindDefinition<MessageActionTarget, MessageFacts> = {
  noun: 'message',
  facts: ({ state, target }) => ({
    text: target.text,
    sessionId: target.sessionId,
    agentId: target.agentId,
    hasComposer:
      target.agentId !== null &&
      target.sessionId !== null &&
      (state.sessionPhaseRuns[target.sessionId] ?? []).some(
        (agent) => agent.id === target.agentId && agent.deletedAt == null,
      ),
  }),
  actions: [
    {
      id: 'message.openAgent',
      label: 'Open the agent',
      icon: CONCEPT_ICONS.agents,
      group: 'open',
      when: ({ facts }) => facts.hasComposer,
      run: ({ facts, env }) => {
        if (facts.sessionId !== null && facts.agentId !== null) {
          env.getState().navigate({
            to: agentPlace({ sessionId: facts.sessionId, agentId: facts.agentId }),
          });
        }
      },
    },
    {
      id: 'message.quote',
      label: 'Quote in reply',
      icon: Quote,
      group: 'act',
      when: ({ facts }) => facts.hasComposer && facts.text.trim() !== '',
      run: ({ facts, env }) => {
        if (facts.agentId === null) {
          return;
        }
        const state = env.getState();
        const draft = state.agentDraft[facts.agentId] ?? '';
        state.setAgentDraft(
          facts.agentId,
          draft.trim() === '' ? `${quoted(facts)}\n\n` : `${draft}\n\n${quoted(facts)}\n\n`,
        );
        dispatchAfterNavigation({ name: 'goodboy:reveal-chat' });
      },
    },
    {
      id: 'message.copy',
      label: 'Copy message',
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.text.trim() !== '',
      run: ({ facts, env }) => env.copyText({ text: plainText(facts) }),
    },
    {
      id: 'message.copyMarkdown',
      label: 'Copy as Markdown',
      icon: FileCode,
      group: 'copy',
      when: ({ facts }) => facts.text.trim() !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.text }),
    },
  ],
};
