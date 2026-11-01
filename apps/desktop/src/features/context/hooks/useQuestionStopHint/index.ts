import type { OpenQuestion, SessionId, WorkflowOrchestrationStop } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { runQuestionsHintOf } from '../../../workflows/runQuestionsHintOf';
import { questionStopOf } from '../../questionStopOf';

type Params = {
  readonly sessionId: SessionId;
  readonly question: OpenQuestion;
};

const NO_RUNS: ReadonlyArray<never> = [];

export const useQuestionStopHint = ({ sessionId, question }: Params): string | null => {
  const stop = useAppStore((state): WorkflowOrchestrationStop | null =>
    questionStopOf({
      question,
      runs: sessionById(state.sessions, sessionId)?.workflowRuns ?? NO_RUNS,
    }),
  );
  return stop === null ? null : runQuestionsHintOf({ stop });
};
