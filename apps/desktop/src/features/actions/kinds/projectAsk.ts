import { X } from 'lucide-react';
import type { ObjectKindDefinition, ProjectAskActionTarget } from '../types';

export type ProjectAskFacts = {
  readonly isBusy: boolean;
  readonly onDiscard: () => void;
};

export const PROJECT_ASK_KIND: ObjectKindDefinition<ProjectAskActionTarget, ProjectAskFacts> = {
  noun: 'request',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'projectAsk.discard',
      label: 'Discard request',
      icon: X,
      group: 'act',
      description: () => 'Tells Auto to start nothing',
      blockedReason: ({ facts }) => (facts.isBusy ? 'Auto is taking your answer' : null),
      when: () => true,
      run: ({ facts }) => {
        if (facts.isBusy) {
          return 'unchanged';
        }
        facts.onDiscard();
        return 'done';
      },
    },
  ],
};
