import { Copy, Link, SquareArrowOutUpRight } from 'lucide-react';
import type { CheckRunActionTarget, ObjectKindDefinition } from '../types';

export type CheckRunFacts = {
  readonly name: string;
  readonly url: string | null;
  readonly onOpen: () => void;
};

export const CHECK_RUN_KIND: ObjectKindDefinition<CheckRunActionTarget, CheckRunFacts> = {
  noun: 'check',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'checkRun.open',
      label: 'Open check',
      icon: SquareArrowOutUpRight,
      group: 'open',
      when: () => true,
      run: ({ facts }) => facts.onOpen(),
    },
    {
      id: 'checkRun.copyLink',
      label: 'Copy link',
      icon: Link,
      group: 'copy',
      when: ({ facts }) => facts.url !== null,
      run: ({ facts, env }) => env.copyText({ text: facts.url ?? '' }),
    },
    {
      id: 'checkRun.copyName',
      label: 'Copy name',
      icon: Copy,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) => env.copyText({ text: facts.name }),
    },
  ],
};
