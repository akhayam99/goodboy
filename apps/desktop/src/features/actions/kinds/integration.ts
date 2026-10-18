import { Inbox, RefreshCw, Unplug } from 'lucide-react';
import type { IntegrationActionTarget, ObjectKindDefinition } from '../types';

export type IntegrationFacts = {
  readonly label: string;
  readonly disconnectDescription: string;
  readonly onOpenTasks: (() => void) | null;
  readonly onCheck: (() => Promise<void>) | null;
  readonly onDisconnect: (() => Promise<void>) | null;
};

export const INTEGRATION_KIND: ObjectKindDefinition<IntegrationActionTarget, IntegrationFacts> = {
  noun: 'integration',
  facts: ({ target }) => (target.facts.label === '' ? null : target.facts),
  actions: [
    {
      id: 'integration.openTasks',
      label: 'Open in Tasks',
      icon: Inbox,
      group: 'open',
      when: ({ facts }) => facts.onOpenTasks !== null,
      run: ({ facts }) => facts.onOpenTasks?.(),
    },
    {
      id: 'integration.check',
      label: 'Check again',
      icon: RefreshCw,
      group: 'act',
      pendingLabel: () => 'Checking',
      when: ({ facts }) => facts.onCheck !== null,
      run: async ({ facts }) => {
        await facts.onCheck?.();
      },
    },
    {
      id: 'integration.disconnect',
      label: 'Disconnect',
      icon: Unplug,
      group: 'danger',
      pendingLabel: () => 'Disconnecting',
      when: ({ facts }) => facts.onDisconnect !== null,
      confirm: ({ facts }) => ({
        title: `Disconnect ${facts.label}?`,
        description: facts.disconnectDescription,
        confirmLabel: `Disconnect ${facts.label}`,
        role: 'danger',
      }),
      run: async ({ facts }) => {
        await facts.onDisconnect?.();
      },
    },
  ],
};
