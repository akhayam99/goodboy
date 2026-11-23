import type { OpenQuestionId } from '@goodboy/types';
import type { SessionSuggestion } from '../../../suggestions/types';

export type SuggestionPlace =
  | Readonly<{ kind: 'questions'; questionId: OpenQuestionId | null }>
  | Readonly<{ kind: 'branch'; mountId: string }>;

type Params = {
  readonly suggestion: SessionSuggestion;
  readonly mountId: string | null;
};

export const suggestionPlaceOf = ({ suggestion, mountId }: Params): SuggestionPlace | null => {
  if (suggestion.kind === 'answer-questions') {
    return { kind: 'questions', questionId: suggestion.payload.firstQuestion?.id ?? null };
  }
  if (mountId === null || suggestion.kind === 'rebase-project') {
    return null;
  }
  return { kind: 'branch', mountId };
};
