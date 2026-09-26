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
  'approve-tool': CONCEPT_ICONS.approval,
  'sign-in': CONCEPT_ICONS.signIn,
  'unblock-step': CONCEPT_ICONS.errors,
  'retry-agent': CONCEPT_ICONS.retry,
  'fix-checks': CONCEPT_ICONS.errors,
  'push-branch': CONCEPT_ICONS.push,
  'open-pr': CONCEPT_ICONS.pr,
  'mark-ready': CONCEPT_ICONS.checks,
  'merge-pr': CONCEPT_ICONS.merge,
  'check-changes': CONCEPT_ICONS.review,
  'close-worktree': CONCEPT_ICONS.delete,
  'continue-with-workflow': CONCEPT_ICONS.workflows,
};
