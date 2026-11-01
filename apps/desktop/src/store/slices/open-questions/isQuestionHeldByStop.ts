import type { OpenQuestion, SessionId } from '@goodboy/types';
import { findWorkflowRun } from '../workflows/findWorkflowRun';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly question: Pick<OpenQuestion, 'workflowRunId'>;
};

export const isQuestionHeldByStop = ({ get, sessionId, question }: Params): boolean => {
  if (question.workflowRunId == null) {
    return false;
  }
  const kind = findWorkflowRun({ get, sessionId, workflowRunId: question.workflowRunId })
    ?.orchestrationStop?.kind;
  return kind != null && kind !== 'questions';
};
