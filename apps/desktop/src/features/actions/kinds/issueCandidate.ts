import { CircleCheck, Copy, Link, ListChecks, SquareArrowOutUpRight } from 'lucide-react';
import { openUrl } from '../../../shared/lib/editor';
import type { IssueCandidateActionTarget, ObjectKindDefinition } from '../types';

export type IssueCandidateFacts = {
  readonly identifier: string;
  readonly url: string;
  readonly isSelected: boolean;
  readonly onToggle: () => void;
  readonly onPickAlone: () => void;
};

export const ISSUE_CANDIDATE_KIND: ObjectKindDefinition<
  IssueCandidateActionTarget,
  IssueCandidateFacts
> = {
  noun: 'issue',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'issueCandidate.openLink',
      label: 'Open link',
      icon: SquareArrowOutUpRight,
      group: 'open',
      when: ({ facts }) => facts.url !== '',
      run: ({ facts }) => openUrl(facts.url),
    },
    {
      id: 'issueCandidate.pickAlone',
      label: 'Pick only this issue',
      icon: CircleCheck,
      group: 'act',
      when: () => true,
      run: ({ facts }) => facts.onPickAlone(),
    },
    {
      id: 'issueCandidate.toggle',
      label: ({ facts }) => (facts.isSelected ? 'Unselect' : 'Select'),
      icon: ListChecks,
      group: 'act',
      when: () => true,
      run: ({ facts }) => facts.onToggle(),
    },
    {
      id: 'issueCandidate.copyLink',
      label: 'Copy link',
      icon: Link,
      group: 'copy',
      when: ({ facts }) => facts.url !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.url }),
    },
    {
      id: 'issueCandidate.copyIdentifier',
      label: ({ facts }) => `Copy ${facts.identifier}`,
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.identifier !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.identifier }),
    },
  ],
};
