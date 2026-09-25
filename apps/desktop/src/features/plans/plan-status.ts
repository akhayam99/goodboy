import { CirclePlay } from 'lucide-react';
import type { PlanStatus } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { StatePresentation } from '../../shared/utils/statePresentation';

export const PLAN_STATUS_PRESENTATION = {
  active: {
    label: 'Ready to run',
    reason: 'nobody ran it yet, running it is your call',
    tone: 'warning',
    icon: CirclePlay,
  },
  consumed: {
    label: 'Ran',
    reason: 'an agent already carried it out',
    tone: 'success',
    icon: CONCEPT_ICONS.runDone,
  },
  superseded: {
    label: 'Replaced',
    reason: 'a newer revision replaced it',
    tone: 'neutral',
    icon: CONCEPT_ICONS.changelog,
  },
  discarded: {
    label: 'Discarded',
    reason: 'dropped, no agent will run it',
    tone: 'neutral',
    icon: CONCEPT_ICONS.runCancelled,
  },
} satisfies Record<PlanStatus, StatePresentation>;

const NEEDS_ATTENTION: StatePresentation = {
  label: 'Needs you',
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
