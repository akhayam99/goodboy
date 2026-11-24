import type { Agent, OpenQuestion } from '@goodboy/types';
import { partitionDelegatedQuestions } from '../context/questionDelegate';
import { stagedQuestionIds } from '../context/stagedQuestionIds';
import { selectOpenQuestions } from './components/SessionOverviewPane/lib';

type Params = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly agents: ReadonlyArray<Agent>;
};

export const waitingQuestionsOf = ({ questions, agents }: Params): ReadonlyArray<OpenQuestion> => {
  const staged = stagedQuestionIds();
  return partitionDelegatedQuestions({
    questions: selectOpenQuestions(questions),
    agents,
  }).answerable.filter((question) => !staged.includes(question.id));
};
