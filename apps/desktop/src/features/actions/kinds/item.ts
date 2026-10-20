import { Copy, SquareArrowOutUpRight } from 'lucide-react';
import type { ItemActionTarget, ObjectKindDefinition } from '../types';

export type ItemFacts = {
  readonly name: string;
  readonly openLabel: string;
  readonly onOpen: (() => void) | null;
};

export const ITEM_KIND: ObjectKindDefinition<ItemActionTarget, ItemFacts> = {
  noun: 'item',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'item.open',
      label: ({ facts }) => facts.openLabel,
      icon: SquareArrowOutUpRight,
      group: 'open',
      when: ({ facts }) => facts.onOpen !== null,
      run: ({ facts }) => facts.onOpen?.(),
    },
    {
      id: 'item.copyName',
      label: 'Copy name',
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.name !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.name }),
    },
  ],
};
