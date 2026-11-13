import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { BrowserTabActionTarget, ObjectKindDefinition } from '../types';

export type BrowserTabFacts = {
  readonly sendLabel: string;
  readonly sendBlockedReason: string | null;
  readonly onSend: () => void;
};

export const BROWSER_TAB_KIND: ObjectKindDefinition<BrowserTabActionTarget, BrowserTabFacts> = {
  noun: 'tab',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'browserTab.sendToAgent',
      label: ({ facts }) => facts.sendLabel,
      icon: CONCEPT_ICONS.agents,
      group: 'act',
      when: () => true,
      blockedReason: ({ facts }) => facts.sendBlockedReason,
      run: ({ facts }) => facts.onSend(),
    },
  ],
};
