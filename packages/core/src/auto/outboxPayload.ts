import type { MessageAttachment } from '@goodboy/types';
import type { DelegationResultV1 } from './result';
import type { AutoDelegationRole } from './roles';

export type UserFacts = Readonly<{
  focusArtifactId: string | null;
  attachedArtifacts: ReadonlyArray<Readonly<{ id: string; revision: number }>>;
  explicitChange: Readonly<{
    artifactId: string;
    baseRevision: number;
    commentIds: ReadonlyArray<string>;
  }> | null;
  lastResultArtifactIds: ReadonlyArray<string>;
  isAmbiguous: boolean;
}>;

export type ResultsPayload = Readonly<{
  kind: 'results';
  batchId: string;
  results: ReadonlyArray<DelegationResultV1>;
}>;

export type QuestionPayload = Readonly<{
  kind: 'question';
  delegationId: string;
  attemptId: string;
  questionId: string;
  role: AutoDelegationRole;
  childAgentId: string;
  text: string;
  suggestedAnswers: ReadonlyArray<string>;
  recommendedAnswer: string | null;
}>;

export type UserPayload = Readonly<{
  kind: 'user';
  text: string;
  facts: UserFacts;
  images?: ReadonlyArray<MessageAttachment>;
}>;

export type RefusalPayload = Readonly<{
  kind: 'refusal';
  runId: string;
  action: string;
  code: string;
  text: string;
  roles?: ReadonlyArray<string>;
}>;

export type StoredDelivery = Readonly<{
  text: string;
  rowIds: ReadonlyArray<string>;
}>;

export const EMPTY_USER_FACTS: UserFacts = {
  focusArtifactId: null,
  attachedArtifacts: [],
  explicitChange: null,
  lastResultArtifactIds: [],
  isAmbiguous: false,
};

type ValueParams = {
  readonly value: unknown;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isResultsPayload = (value: unknown): value is ResultsPayload =>
  isRecord(value) &&
  value['kind'] === 'results' &&
  typeof value['batchId'] === 'string' &&
  Array.isArray(value['results']);

export const isQuestionPayload = (value: unknown): value is QuestionPayload =>
  isRecord(value) &&
  value['kind'] === 'question' &&
  typeof value['delegationId'] === 'string' &&
  typeof value['attemptId'] === 'string' &&
  typeof value['questionId'] === 'string' &&
  typeof value['text'] === 'string';

export const isUserPayload = (value: unknown): value is UserPayload =>
  isRecord(value) &&
  value['kind'] === 'user' &&
  typeof value['text'] === 'string' &&
  isRecord(value['facts']);

export const isRefusalPayload = (value: unknown): value is RefusalPayload =>
  isRecord(value) &&
  value['kind'] === 'refusal' &&
  typeof value['runId'] === 'string' &&
  typeof value['text'] === 'string';

export const storedDeliveryOf = ({ value }: ValueParams): StoredDelivery | null => {
  if (!isRecord(value)) {
    return null;
  }
  const delivery = value['delivery'];
  if (!isRecord(delivery)) {
    return null;
  }
  const text = delivery['text'];
  const rowIds = delivery['rowIds'];
  if (typeof text !== 'string' || !Array.isArray(rowIds)) {
    return null;
  }
  return {
    text,
    rowIds: rowIds.filter((id: unknown): id is string => typeof id === 'string'),
  };
};
