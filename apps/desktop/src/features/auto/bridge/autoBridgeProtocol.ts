import type { AutoUserTurnParams, AutoUserTurnPort } from '../autoUserTurnPort';
import type { DelegationDecision, DelegationDecisionPort } from '../delegationDecisionPort';
import type { TreeRetryPort } from '../treeRetryPort';
import type { TreeStopPort } from '../treeStopPort';

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
  | Readonly<{ kind: 'userTurn'; messageId: string; turn: AutoUserTurnParams }>
  | Readonly<{ kind: 'decision'; delegationId: string; decision: DelegationDecision }>;

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
  userTurn: AutoUserTurnPort;
  decision: DelegationDecisionPort;
}>;
