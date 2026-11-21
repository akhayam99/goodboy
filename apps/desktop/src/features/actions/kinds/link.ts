import { SquareArrowOutUpRight } from '@goodboy/ui/icons';
import { openWebAction } from '../openWebAction';
import type { LinkActionTarget, ObjectKindDefinition } from '../types';
import { VERBS } from '../../../shared/utils/verbs';

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
      run: ({ facts, env }) => openWebAction({ url: facts.href, env }),
    },
    {
      id: 'link.copy',
      ...VERBS.copyLink,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.href }),
    },
  ],
};
