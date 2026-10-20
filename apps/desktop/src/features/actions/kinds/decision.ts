import { Copy, Scale } from 'lucide-react';
import type { DecisionActionTarget, ObjectKindDefinition } from '../types';

export type DecisionFacts = {
  readonly number: number;
  readonly text: string;
  readonly onShow: (() => void) | null;
};

export const DECISION_KIND: ObjectKindDefinition<DecisionActionTarget, DecisionFacts> = {
  noun: 'decision',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'decision.show',
      label: ({ facts }) => `Show decision ${facts.number}`,
      icon: Scale,
      group: 'open',
      when: ({ facts }) => facts.onShow !== null,
      run: ({ facts }) => facts.onShow?.(),
    },
    {
      id: 'decision.copy',
      label: 'Copy decision',
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.text !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.text }),
    },
  ],
};
