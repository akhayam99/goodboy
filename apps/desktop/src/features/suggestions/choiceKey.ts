import type { SessionSuggestion } from './types';

type Params = {
  readonly suggestion: SessionSuggestion;
  readonly choiceId: string;
};

export const choiceKey = ({ suggestion, choiceId }: Params) =>
  `${suggestion.id}:choice:${choiceId}`;
