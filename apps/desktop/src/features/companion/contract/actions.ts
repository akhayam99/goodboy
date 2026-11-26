import type { ActionId, Digest, Int, ObjectVersion } from './primitives';
import type { MergeMethod, SessionAccess, StartKind, StartStops, TaskProvider } from './vocabulary';
import type { AgentState, RunState } from './projections';

export type ActionBase = {
  readonly actionId: ActionId;
  readonly workspaceId: string;
};

export type SessionActionBase = ActionBase & {
  readonly sessionId: string;
};

export type AnswerQuestionAction = SessionActionBase & {
  readonly kind: 'answerQuestion';
  readonly questionId: string;
  readonly seenVersion: ObjectVersion;
  readonly text: string;
};

export type ApprovePlanAction = SessionActionBase & {
  readonly kind: 'approvePlan';
  readonly planId: string;
  readonly seenPlanVersion: Int;
};

export type RequestPlanChangesAction = SessionActionBase & {
  readonly kind: 'requestPlanChanges';
  readonly planId: string;
  readonly seenPlanVersion: Int;
  readonly text: string;
};

export type PermissionVerdict = 'allow' | 'deny';

export type AnswerPermissionAction = SessionActionBase & {
  readonly kind: 'answerPermission';
  readonly agentId: string;
  readonly requestId: string;
  readonly seenInputHash: Digest;
  readonly verdict: PermissionVerdict;
};

export type RaiseLimitAction = SessionActionBase & {
  readonly kind: 'raiseLimit';
  readonly runId: string;
  readonly seenLimit: number;
  readonly offeredAmount: number;
};

export type UndoRaiseLimitAction = SessionActionBase & {
  readonly kind: 'undoRaiseLimit';
  readonly runId: string;
  readonly raisedActionId: ActionId;
};

export type StopRunAction = SessionActionBase & {
  readonly kind: 'stopRun';
  readonly runId: string;
  readonly seenState: RunState;
};

export type ContinueRunAction = SessionActionBase & {
  readonly kind: 'continueRun';
  readonly runId: string;
  readonly seenState: RunState;
};

export type StopAgentAction = SessionActionBase & {
  readonly kind: 'stopAgent';
  readonly agentId: string;
  readonly seenState: AgentState;
};

export type ContinueAgentAction = SessionActionBase & {
  readonly kind: 'continueAgent';
  readonly agentId: string;
  readonly seenState: AgentState;
};

export type StopAgentTreeAction = SessionActionBase & {
  readonly kind: 'stopAgentTree';
  readonly agentId: string;
  readonly seenState: AgentState;
};

export type SendToAgentAction = SessionActionBase & {
  readonly kind: 'sendToAgent';
  readonly agentId: string;
  readonly seenVersion: ObjectVersion;
  readonly text: string;
};

export type SlackVerdict = 'send' | 'discard';

export type AnswerSlackReplyAction = SessionActionBase & {
  readonly kind: 'answerSlackReply';
  readonly verdict: SlackVerdict;
  readonly draftId: string;
  readonly seenVersion: ObjectVersion;
  readonly text: string;
};

export type MergePrAction = SessionActionBase & {
  readonly kind: 'mergePr';
  readonly prNumber: Int;
  readonly expectedHeadSha: string;
  readonly method: MergeMethod;
  readonly shouldDeleteBranch: boolean;
};

export type StartSessionTask = {
  readonly provider: TaskProvider;
  readonly key: string;
};

export type StartSessionAction = ActionBase & {
  readonly kind: 'startSession';
  readonly projectId: string;
  readonly goal: string;
  readonly task: StartSessionTask | null;
  readonly access: SessionAccess;
  readonly startKind: StartKind;
  readonly presetId: string | null;
  readonly limitUsd: number | null;
  readonly stops: StartStops | null;
};

export type TrainRequestEntry = {
  readonly sessionId: string;
  readonly prNumber: Int;
  readonly expectedHeadSha: string;
};

export type MergeTrainAction = ActionBase & {
  readonly kind: 'mergeTrain';
  readonly method: MergeMethod;
  readonly entries: ReadonlyArray<TrainRequestEntry>;
};

export type StopTrainAction = ActionBase & {
  readonly kind: 'stopTrain';
  readonly trainId: string;
};

export type MobileAction =
  | AnswerQuestionAction
  | ApprovePlanAction
  | RequestPlanChangesAction
  | AnswerPermissionAction
  | RaiseLimitAction
  | UndoRaiseLimitAction
  | StopRunAction
  | ContinueRunAction
  | StopAgentAction
  | ContinueAgentAction
  | StopAgentTreeAction
  | SendToAgentAction
  | AnswerSlackReplyAction
  | MergePrAction
  | StartSessionAction
  | MergeTrainAction
  | StopTrainAction;

export type ActionResult = 'done' | 'refused' | 'failed';

export type RefusalCode =
  | 'version-changed'
  | 'already-decided'
  | 'duplicate-in-flight'
  | 'not-permitted'
  | 'rate-limited'
  | 'busy'
  | 'not-mergeable'
  | 'invalid-request'
  | 'unknown-target'
  | 'mac-closed';

export type ChangedFact = {
  readonly label: string;
  readonly was: string;
  readonly now: string;
};

export type Refusal = {
  readonly code: RefusalCode;
  readonly message: string;
  readonly changes: ReadonlyArray<ChangedFact>;
};

export type ActionOutcome = {
  readonly actionId: ActionId;
  readonly result: ActionResult;
  readonly isReplay: boolean;
  readonly refusal: Refusal | null;
  readonly error: string | null;
  readonly undoActionId: ActionId | null;
  readonly createdSessionId: string | null;
};
