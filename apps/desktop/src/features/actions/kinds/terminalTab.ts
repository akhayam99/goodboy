import { Copy } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ObjectKindDefinition, TerminalTabActionTarget } from '../types';

type TerminalSendOutputFacts = {
  readonly label: string;
  readonly blockedReason: string | null;
  readonly onSend: () => void;
};

export type TerminalTabFacts = {
  readonly path: string | null;
  readonly isWorkspace: boolean;
  readonly sessionId: SessionId | null;
  readonly onOpenSession: () => void;
  readonly sendOutput?: TerminalSendOutputFacts;
};

export const TERMINAL_TAB_KIND: ObjectKindDefinition<TerminalTabActionTarget, TerminalTabFacts> = {
  noun: 'terminal',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'terminalTab.openSession',
      label: 'Open session',
      icon: CONCEPT_ICONS.sessions,
      group: 'open',
      when: ({ facts }) => facts.sessionId !== null,
      run: ({ facts }) => facts.onOpenSession(),
    },
    {
      id: 'terminalTab.sendLastOutput',
      label: ({ facts }) => facts.sendOutput?.label ?? 'Send last output',
      icon: CONCEPT_ICONS.agents,
      group: 'act',
      when: ({ facts }) => facts.sendOutput !== undefined,
      blockedReason: ({ facts }) => facts.sendOutput?.blockedReason ?? null,
      run: ({ facts }) => facts.sendOutput?.onSend(),
    },
    {
      id: 'terminalTab.copyPath',
      label: ({ facts }) => (facts.isWorkspace ? 'Copy folder path' : 'Copy worktree path'),
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.path !== null,
      run: async ({ facts, env }) => {
        if (facts.path === null) {
          return;
        }
        await env.copyText({ text: facts.path });
      },
    },
  ],
};
