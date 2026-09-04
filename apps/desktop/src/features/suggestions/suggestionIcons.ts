import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { SuggestionKind } from './types';

export const SUGGESTION_ICONS: Record<SuggestionKind, LucideIcon> = {
  'workflow-next-step': CONCEPT_ICONS.nextSteps,
  'plan-ready': CONCEPT_ICONS.plans,
  'resolve-threads': CONCEPT_ICONS.resolve,
  'rebase-project': CONCEPT_ICONS.branch,
  'answer-questions': CONCEPT_ICONS.questions,
  'mount-project': CONCEPT_ICONS.mount,
};
