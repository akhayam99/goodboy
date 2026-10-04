import { CornerDownRight, type LucideIcon } from 'lucide-react';
import type { HandoffSender } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export const HANDOFF_SENDER_ICON: Readonly<Record<HandoffSender['kind'], LucideIcon>> = {
  you: CONCEPT_ICONS.agents,
  orchestrator: CONCEPT_ICONS.orchestrator,
  workflowStep: CONCEPT_ICONS.workflows,
  resolve: CONCEPT_ICONS.resolve,
  recheck: CONCEPT_ICONS.resolve,
  scribe: CONCEPT_ICONS.agents,
  historyRewrite: CONCEPT_ICONS.agents,
  parent: CONCEPT_ICONS.agents,
  question: CONCEPT_ICONS.questions,
  followUp: CornerDownRight,
};
