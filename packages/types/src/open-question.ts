import type {
  AgentId,
  IsoDateTime,
  OpenQuestionId,
  SessionId,
  WorkflowId,
  WorkflowRunId,
} from './ids';

export type OpenQuestionStatus = 'open' | 'answered' | 'dismissed';

export type OpenQuestion = Readonly<{
  id: OpenQuestionId;
  sessionId: SessionId;
  workflowId?: WorkflowId;
  workflowRunId?: WorkflowRunId;
  createdByStepOrdinal?: number;
  ownedByStepOrdinal?: number;
  createdByAgentId?: AgentId;
  text: string;
  suggestedAnswers: ReadonlyArray<string>;
  userAnswer: string | null;
  status: OpenQuestionStatus;
  createdAt: IsoDateTime;
  answeredAt?: IsoDateTime;
  dismissedAt?: IsoDateTime;
}>;
