import { AppWindow, ArrowRightLeft, Copy } from 'lucide-react';
import type { ObjectKindDefinition, WorkspaceActionTarget } from '../types';

export type WorkspaceFacts = {
  readonly name: string;
  readonly onOpen: () => void;
  readonly onOpenNewWindow: () => void;
};

export const WORKSPACE_KIND: ObjectKindDefinition<WorkspaceActionTarget, WorkspaceFacts> = {
  noun: 'workspace',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'workspace.open',
      label: ({ facts }) => `Switch to ${facts.name}`,
      icon: ArrowRightLeft,
      group: 'open',
      when: () => true,
      run: ({ facts }) => facts.onOpen(),
    },
    {
      id: 'workspace.openNewWindow',
      label: 'Open in new window',
      icon: AppWindow,
      group: 'open',
      when: () => true,
      run: ({ facts }) => facts.onOpenNewWindow(),
    },
    {
      id: 'workspace.copyName',
      label: 'Copy name',
      icon: Copy,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.name }),
    },
  ],
};
