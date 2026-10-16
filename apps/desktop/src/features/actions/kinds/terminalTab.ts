import { Copy } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ObjectKindDefinition, TerminalTabActionTarget } from '../types';

export type TerminalTabFacts = {
  readonly path: string | null;
  readonly isWorkspace: boolean;
  readonly sessionId: SessionId | null;
  readonly onOpenSession: () => void;
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
