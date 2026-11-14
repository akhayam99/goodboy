import type { AskAnswer, AskAnswerPort } from '../askAnswerPort';
import type { AutoChildTurnParams, AutoChildTurnPort } from '../autoChildTurnPort';
import type { AutoUserTurnParams, AutoUserTurnPort } from '../autoUserTurnPort';
import type { DelegationDecision, DelegationDecisionPort } from '../delegationDecisionPort';
import type { ChecksRerunPort } from '../checksRerunPort';
import type { PublishAct, PublishPort } from '../publishPort';
import type { SendNowPort } from '../sendNowPort';
import type { TreeRetryPort } from '../treeRetryPort';
import type { TreeStopPort } from '../treeStopPort';
import type { WithdrawPort } from '../withdrawPort';

export const AUTO_BRIDGE_EVENT = {
  request: 'goodboy:auto-request',
  response: 'goodboy:auto-response',
  artifactsChanged: 'goodboy:auto-artifacts-changed',
} as const;

export type AutoArtifactsChanged = Readonly<{
  sessionId: string;
}>;

export type AutoBridgeCall =
  | Readonly<{ kind: 'stop'; treeId: string }>
  | Readonly<{ kind: 'retry'; treeId: string }>
  | Readonly<{ kind: 'sendNow'; treeId: string; rowId: string }>
  | Readonly<{ kind: 'withdraw'; treeId: string; rowId: string }>
  | Readonly<{ kind: 'rerunChecks'; delegationId: string }>
  | Readonly<{ kind: 'publish'; act: PublishAct; delegationIds: ReadonlyArray<string> }>
  | Readonly<{ kind: 'userTurn'; messageId: string; turn: AutoUserTurnParams }>
  | Readonly<{ kind: 'childTurn'; turn: AutoChildTurnParams }>
  | Readonly<{
      kind: 'decision';
      delegationId: string;
      decision: DelegationDecision;
      hint?: string;
    }>
  | Readonly<{ kind: 'answerAsk'; askId: string; answer: AskAnswer }>;

export type AutoBridgeRequest = Readonly<{
  id: string;
  call: AutoBridgeCall;
}>;

export type AutoBridgeResponse =
  | Readonly<{ id: string; isOk: true; result: unknown }>
  | Readonly<{ id: string; isOk: false; error: string }>;

type EmitParams = {
  readonly event: string;
  readonly payload: unknown;
};

type ListenParams = {
  readonly event: string;
  readonly onPayload: (payload: unknown) => void;
};

export type AutoBridgeBus = Readonly<{
  emit: (params: EmitParams) => Promise<void>;
  listen: (params: ListenParams) => Promise<() => void>;
}>;

export type AutoBridgePorts = Readonly<{
  stop: TreeStopPort;
  retry: TreeRetryPort;
  sendNow: SendNowPort;
  withdraw: WithdrawPort;
  rerunChecks: ChecksRerunPort;
  publish: PublishPort;
  userTurn: AutoUserTurnPort;
  childTurn: AutoChildTurnPort;
  decision: DelegationDecisionPort;
  answerAsk: AskAnswerPort;
}>;
