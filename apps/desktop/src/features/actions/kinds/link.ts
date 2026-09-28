import { Link, SquareArrowOutUpRight } from 'lucide-react';
import { openUrl } from '../../../shared/lib/editor';
import type { LinkActionTarget, ObjectKindDefinition } from '../types';

export type LinkFacts = {
  readonly href: string;
};

export const LINK_KIND: ObjectKindDefinition<LinkActionTarget, LinkFacts> = {
  noun: 'link',
  facts: ({ target }) => (target.href === '' ? null : { href: target.href }),
  actions: [
    {
      id: 'link.open',
      label: 'Open link',
      icon: SquareArrowOutUpRight,
      group: 'open',
      when: () => true,
      run: ({ facts }) => openUrl(facts.href),
    },
    {
      id: 'link.copy',
      label: 'Copy link',
      icon: Link,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.href }),
    },
  ],
};
