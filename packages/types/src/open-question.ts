import type {
  AgentId,
  IsoDateTime,
  OpenQuestionId,
  SessionId,
  WorkflowId,
  WorkflowRunId,
} from './ids';

export type OpenQuestionStatus = 'open' | 'answered' | 'dismissed';

export type OpenQuestionSelectMode = 'one' | 'many';

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
  recommendedAnswer?: string;
  selectMode?: OpenQuestionSelectMode;
  isBlocking: boolean;
  userAnswer: string | null;
  answerSource?: 'user' | 'agent';
  answeredByAgentId?: AgentId;
  turnOrdinal?: number;
  status: OpenQuestionStatus;
  createdAt: IsoDateTime;
  answeredAt?: IsoDateTime;
  answerDeliveredAt?: IsoDateTime;
  dismissedAt?: IsoDateTime;
}>;
