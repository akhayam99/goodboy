import type { ActionId, Int, ObjectVersion } from './primitives';
import type { RunState } from './projections';

export type OfferedAmount = {
  readonly amount: number;
  readonly text: string;
};

export type QuestionDecision = {
  readonly kind: 'question';
  readonly actionId: ActionId;
  readonly questionId: string;
  readonly version: ObjectVersion;
  readonly text: string;
  readonly options: ReadonlyArray<string>;
  readonly recommended: string | null;
};

export type PlanDecision = {
  readonly kind: 'plan';
  readonly actionId: ActionId;
  readonly planId: string;
  readonly planVersion: Int;
  readonly summary: string;
  readonly steps: ReadonlyArray<string>;
  readonly touches: ReadonlyArray<string>;
  readonly requestChangesActionId: ActionId;
};

export type PermissionDecision = {
  readonly kind: 'permission';
  readonly actionId: ActionId;
  readonly agentId: string;
  readonly requestId: string;
  readonly inputHash: string;
  readonly toolName: string;
  readonly inputSummary: string;
  readonly command: string;
};

export type LimitDecision = {
  readonly kind: 'limit';
  readonly actionId: ActionId;
  readonly runId: string;
  readonly currentLimit: number;
  readonly currentLimitText: string;
  readonly offers: ReadonlyArray<OfferedAmount>;
};

export type SlackDecision = {
  readonly kind: 'slack';
  readonly actionId: ActionId;
  readonly draftId: string;
  readonly version: ObjectVersion;
  readonly draft: string;
};

export type RunDecision = {
  readonly kind: 'run';
  readonly actionId: ActionId;
  readonly runId: string;
  readonly seenState: RunState;
  readonly stopActionId: ActionId | null;
};

export type Decision =
  | QuestionDecision
  | PlanDecision
  | PermissionDecision
  | LimitDecision
  | SlackDecision
  | RunDecision;
