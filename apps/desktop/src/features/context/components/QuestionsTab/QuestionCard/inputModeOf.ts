import type { OpenQuestion } from '@goodboy/types';
import type { AnswerInputMode } from '../AnswerSubmitButton/answerInputMode';

type Params = {
  readonly question: OpenQuestion;
  readonly suggestions: ReadonlyArray<string>;
};

export const inputModeOf = ({ question, suggestions }: Params): AnswerInputMode => {
  if (suggestions.length === 0) {
    return 'text';
  }
  return question.selectMode === 'many' ? 'many' : 'one';
};
