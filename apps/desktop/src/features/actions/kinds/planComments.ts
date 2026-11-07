import { Check, Trash2 } from 'lucide-react';
import type { ObjectKindDefinition, PlanCommentsActionTarget } from '../types';

export type PlanCommentsFacts = {
  readonly count: string;
  readonly isBusy: boolean;
  readonly onApproveAnyway: () => void;
  readonly onDiscard: () => void;
};

export const PLAN_COMMENTS_KIND: ObjectKindDefinition<PlanCommentsActionTarget, PlanCommentsFacts> =
  {
    noun: 'plan comments',
    facts: ({ target }) => target.facts,
    actions: [
      {
        id: 'planComments.approveAnyway',
        label: 'Approve anyway',
        icon: Check,
        group: 'act',
        blockedReason: ({ facts }) => (facts.isBusy ? 'Auto is taking your answer' : null),
        when: () => true,
        run: ({ facts }) => {
          if (facts.isBusy) {
            return 'unchanged';
          }
          facts.onApproveAnyway();
          return 'done';
        },
      },
      {
        id: 'planComments.discard',
        label: 'Discard your comments',
        icon: Trash2,
        group: 'danger',
        when: () => true,
        confirm: ({ facts }) => ({
          title: `Discard ${facts.count}?`,
          description: 'They are removed from the plan and nothing is sent to the Planner.',
          confirmLabel: 'Discard',
          role: 'danger',
        }),
        run: ({ facts }) => {
          facts.onDiscard();
          return 'done';
        },
      },
    ],
  };
