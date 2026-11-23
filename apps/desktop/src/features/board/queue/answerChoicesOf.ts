import type { OpenQuestion } from '@goodboy/types';
import { orderSuggestions } from '../../context/orderSuggestions';

type Params = {
  readonly question: OpenQuestion;
};

export const answerChoicesOf = ({ question }: Params): ReadonlyArray<string> =>
  orderSuggestions({
    suggestions: question.suggestedAnswers,
    recommendedAnswer: question.recommendedAnswer ?? '',
  });
