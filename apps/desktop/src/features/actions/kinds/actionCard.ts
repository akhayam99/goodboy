import { SquareArrowOutUpRight } from 'lucide-react';
import type {
  ActionCardActionTarget,
  ActionDefinition,
  FoldedVerb,
  ObjectKindDefinition,
} from '../types';

export type ActionCardFacts = {
  readonly verbs: ReadonlyArray<FoldedVerb>;
};

type FoldedVerbsParams = {
  readonly verbs: ReadonlyArray<FoldedVerb>;
  readonly kind: string;
};

export const foldedVerbActions = <F>({
  verbs,
  kind,
}: FoldedVerbsParams): ReadonlyArray<ActionDefinition<F>> =>
  verbs.map((verb) => ({
    id: `${kind}.folded.${verb.id}`,
    label: verb.label,
    description: () => verb.description ?? null,
    icon: SquareArrowOutUpRight,
    group: 'open',
    when: () => true,
    run: () => verb.run(),
  }));

export const ACTION_CARD_KIND: ObjectKindDefinition<ActionCardActionTarget, ActionCardFacts> = {
  noun: 'card',
  facts: ({ target }) => ({ verbs: target.verbs }),
  actions: [],
  adapted: ({ facts }) => foldedVerbActions({ verbs: facts.verbs, kind: 'actionCard' }),
};
