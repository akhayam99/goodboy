import type { OpenQuestion, SessionId } from '@goodboy/types';
import { questionStopOf } from '../../../features/context/questionStopOf';
import { runQuestionsHintOf } from '../../../features/workflows/runQuestionsHintOf';
import { sessionById } from '../sessions/sessionIndex';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

export const stoppedQuestionHintOf = ({ get, sessionId, questions }: Params): string | null => {
  const runs = sessionById(get().sessions, sessionId)?.workflowRuns ?? [];
  for (const question of questions) {
    const stop = questionStopOf({ question, runs });
    if (stop !== null) {
      return runQuestionsHintOf({ stop });
    }
  }
  return null;
};
