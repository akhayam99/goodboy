import type { BranchTab } from '../../../../store/slices/navigation/types';
import type { SessionSuggestion } from '../../../suggestions/types';

export type SuggestionPlace =
  Readonly<{ kind: 'questions' }> | Readonly<{ kind: 'branch'; mountId: string; tab: BranchTab }>;

type Params = {
  readonly suggestion: SessionSuggestion;
  readonly mountId: string | null;
};

const TAB: Partial<Record<SessionSuggestion['kind'], BranchTab>> = {
  'fix-checks': 'checks',
  'resolve-threads': 'comments',
  'mark-ready': 'pr',
  'merge-pr': 'pr',
};

export const suggestionPlaceOf = ({ suggestion, mountId }: Params): SuggestionPlace | null => {
  if (suggestion.kind === 'answer-questions') {
    return { kind: 'questions' };
  }
  if (mountId === null || suggestion.kind === 'rebase-project') {
    return null;
  }
  return { kind: 'branch', mountId, tab: TAB[suggestion.kind] ?? 'commits' };
};
