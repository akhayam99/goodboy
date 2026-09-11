import type { PlanStatus } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { StatePresentation } from '../../shared/utils/statePresentation';

export const PLAN_STATUS_PRESENTATION = {
  active: {
    label: 'active',
    reason: 'the next agent turn will follow this plan',
    tone: 'info',
    icon: CONCEPT_ICONS.plans,
  },
  consumed: {
    label: 'consumed',
    reason: 'an agent already executed it',
    tone: 'merged',
    icon: CONCEPT_ICONS.runDone,
  },
  superseded: {
    label: 'superseded',
    reason: 'a newer plan replaced it',
    tone: 'neutral',
    icon: CONCEPT_ICONS.changelog,
  },
  discarded: {
    label: 'discarded',
    reason: 'dropped, no agent will run it',
    tone: 'neutral',
    icon: CONCEPT_ICONS.runCancelled,
  },
} satisfies Record<PlanStatus, StatePresentation>;

const NEEDS_ATTENTION: StatePresentation = {
  label: 'needs you',
  reason: 'the plan has open questions to answer before an agent can follow it',
  tone: 'warning',
  icon: CONCEPT_ICONS.questions,
};

type Params = {
  readonly status: PlanStatus;
  readonly openQuestionCount?: number;
};

export const describePlanStatus = ({ status, openQuestionCount = 0 }: Params): StatePresentation =>
  status === 'active' && openQuestionCount > 0 ? NEEDS_ATTENTION : PLAN_STATUS_PRESENTATION[status];
