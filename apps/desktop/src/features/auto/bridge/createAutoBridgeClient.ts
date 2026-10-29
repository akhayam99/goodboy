import type { AutoUserTurnParams, AutoUserTurnResult } from '../autoUserTurnPort';
import type { ChecksRerunResult } from '../checksRerunPort';
import type { DelegationDecisionResult } from '../delegationDecisionPort';
import type { PublishResult } from '../publishPort';
import type { TreeRetryResult } from '../treeRetryPort';
import type { TreeStopResult } from '../treeStopPort';
import {
  AUTO_BRIDGE_EVENT,
  type AutoBridgeBus,
  type AutoBridgeCall,
  type AutoBridgePorts,
  type AutoBridgeRequest,
} from './autoBridgeProtocol';
import { isRecord } from '@goodboy/types/helpers';

const AUTO_BRIDGE_TIMEOUT_MS = 30_000;

const AUTO_BRIDGE_LONG_TIMEOUT_MS = 30 * 60_000;

const NO_ANSWER = 'The main window did not answer. Do it from the main window.';

const STOP_RESULTS: ReadonlyArray<TreeStopResult> = ['stopped', 'stuck', 'not_owner'];

const TURN_RESULTS: ReadonlyArray<AutoUserTurnResult> = ['queued', 'lost'];

const DECISION_RESULTS: ReadonlyArray<DelegationDecisionResult> = ['confirmed', 'declined', 'lost'];

const isStopResult = (value: unknown): value is TreeStopResult =>
  STOP_RESULTS.some((result) => result === value);

const isTurnResult = (value: unknown): value is AutoUserTurnResult =>
  TURN_RESULTS.some((result) => result === value);

const isDecisionResult = (value: unknown): value is DelegationDecisionResult =>
  DECISION_RESULTS.some((result) => result === value);

const isRetryResult = (value: unknown): value is TreeRetryResult =>
  isRecord(value) &&
  (value['kind'] === 'retried' ||
    (value['kind'] === 'refused' && typeof value['message'] === 'string'));

const isRerunResult = (value: unknown): value is ChecksRerunResult =>
  isRecord(value) &&
  ((value['kind'] === 'rerun' &&
    (value['verdict'] === 'green' ||
      value['verdict'] === 'red' ||
      value['verdict'] === 'not_checked')) ||
    (value['kind'] === 'refused' && typeof value['message'] === 'string'));

const PUBLISH_STATES = [
  'pushing',
  'awaiting_confirm',
  'pushed',
  'declined',
  'failed',
  'put_back',
  'refused',
] as const;

const isPublishRow = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value['delegationId'] === 'string' &&
  PUBLISH_STATES.some((state) => state === value['state']) &&
  (value['message'] === null || typeof value['message'] === 'string');

const isPublishResult = (value: unknown): value is PublishResult =>
  isRecord(value) &&
  value['kind'] === 'done' &&
  Array.isArray(value['rows']) &&
  value['rows'].every(isPublishRow);

type Pending = {
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

export type AutoBridgeClientParams = Readonly<{
  bus: AutoBridgeBus;
  newId: () => string;
  timeoutMs?: number;
  longTimeoutMs?: number;
}>;

export type AutoBridgeClient = Readonly<{
  ports: AutoBridgePorts;
  close: () => void;
}>;

type TurnKeyParams = {
  readonly turn: AutoUserTurnParams;
};

const turnKeyOf = ({ turn }: TurnKeyParams): string =>
  JSON.stringify([
    turn.agentId,
    turn.sessionId,
    turn.text,
    (turn.images ?? []).map((image) => image.fileName),
  ]);

type SendParams = {
  readonly call: AutoBridgeCall;
  readonly waitMs: number;
};

type AskParams<Result> = {
  readonly call: AutoBridgeCall;
  readonly isResult: (value: unknown) => value is Result;
  readonly waitMs?: number;
};

export const createAutoBridgeClient = async ({
  bus,
  newId,
  timeoutMs = AUTO_BRIDGE_TIMEOUT_MS,
  longTimeoutMs = AUTO_BRIDGE_LONG_TIMEOUT_MS,
}: AutoBridgeClientParams): Promise<AutoBridgeClient> => {
  const pending = new Map<string, Pending>();
  const unsettledTurns = new Map<string, string>();
  const unlisten = await bus.listen({
    event: AUTO_BRIDGE_EVENT.response,
    onPayload: (payload) => {
      if (!isRecord(payload) || typeof payload['id'] !== 'string') {
        return;
      }
      const waiting = pending.get(payload['id']);
      if (waiting === undefined) {
        return;
      }
      pending.delete(payload['id']);
      clearTimeout(waiting.timer);
      if (payload['isOk'] === true) {
        waiting.resolve(payload['result']);
        return;
      }
      const error = payload['error'];
      waiting.reject(new Error(typeof error === 'string' && error !== '' ? error : NO_ANSWER));
    },
  });
  const send = ({ call, waitMs }: SendParams): Promise<unknown> =>
    new Promise<unknown>((resolve, reject) => {
      const id = newId();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(NO_ANSWER));
      }, waitMs);
      pending.set(id, { resolve, reject, timer });
      const request: AutoBridgeRequest = { id, call };
      bus.emit({ event: AUTO_BRIDGE_EVENT.request, payload: request }).catch((error: unknown) => {
        pending.delete(id);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(NO_ANSWER));
      });
    });
  const ask = async <Result>({
    call,
    isResult,
    waitMs = timeoutMs,
  }: AskParams<Result>): Promise<Result> => {
    const result = await send({ call, waitMs });
    if (!isResult(result)) {
      throw new Error(NO_ANSWER);
    }
    return result;
  };
  const ports: AutoBridgePorts = {
    stop: ({ treeId }) => ask({ call: { kind: 'stop', treeId }, isResult: isStopResult }),
    retry: ({ treeId }) => ask({ call: { kind: 'retry', treeId }, isResult: isRetryResult }),
    sendNow: ({ treeId, rowId }) =>
      ask({ call: { kind: 'sendNow', treeId, rowId }, isResult: isRetryResult }),
    rerunChecks: ({ delegationId }) =>
      ask({
        call: { kind: 'rerunChecks', delegationId },
        isResult: isRerunResult,
        waitMs: longTimeoutMs,
      }),
    publish: ({ act, delegationIds }) =>
      ask({
        call: { kind: 'publish', act, delegationIds },
        isResult: isPublishResult,
        waitMs: longTimeoutMs,
      }),
    decision: ({ delegationId, decision, hint }) =>
      ask({
        call: { kind: 'decision', delegationId, decision, ...(hint === undefined ? {} : { hint }) },
        isResult: isDecisionResult,
      }),
    userTurn: async (turn) => {
      const key = turnKeyOf({ turn });
      const messageId = unsettledTurns.get(key) ?? newId();
      const result = await ask({
        call: { kind: 'userTurn', messageId, turn },
        isResult: isTurnResult,
      }).catch((): AutoUserTurnResult => 'lost');
      if (result === 'queued') {
        unsettledTurns.delete(key);
        return result;
      }
      unsettledTurns.set(key, messageId);
      return result;
    },
  };
  const close = (): void => {
    unlisten();
    for (const waiting of pending.values()) {
      clearTimeout(waiting.timer);
      waiting.reject(new Error(NO_ANSWER));
    }
    pending.clear();
  };
  return { ports, close };
};
