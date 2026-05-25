import type { IsoDateTime, OpenQuestionId, SessionId, WorkflowId } from './ids';

export type OpenQuestionStatus = 'open' | 'answered' | 'dismissed';

export type OpenQuestion = Readonly<{
  id: OpenQuestionId;
  sessionId: SessionId;
  workflowId?: WorkflowId;
  createdByStepOrdinal?: number;
  ownedByStepOrdinal?: number;
  text: string;
  suggestedAnswers: ReadonlyArray<string>;
  userAnswer: string | null;
  status: OpenQuestionStatus;
  createdAt: IsoDateTime;
  answeredAt?: IsoDateTime;
  dismissedAt?: IsoDateTime;
}>;
