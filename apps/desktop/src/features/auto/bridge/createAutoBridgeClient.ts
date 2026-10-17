import type { AutoUserTurnResult } from '../autoUserTurnPort';
import type { DelegationDecisionResult } from '../delegationDecisionPort';
import type { TreeRetryResult } from '../treeRetryPort';
import type { TreeStopResult } from '../treeStopPort';
import {
  AUTO_BRIDGE_EVENT,
  type AutoBridgeBus,
  type AutoBridgeCall,
  type AutoBridgePorts,
  type AutoBridgeRequest,
} from './autoBridgeProtocol';

const AUTO_BRIDGE_TIMEOUT_MS = 30_000;

const NO_ANSWER = 'The main window did not answer. Do it from the main window.';

const STOP_RESULTS: ReadonlyArray<TreeStopResult> = ['stopped', 'stuck', 'not_owner'];

const TURN_RESULTS: ReadonlyArray<AutoUserTurnResult> = ['queued', 'lost'];

const DECISION_RESULTS: ReadonlyArray<DelegationDecisionResult> = ['confirmed', 'declined', 'lost'];

type RecordValue = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

type Pending = {
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

export type AutoBridgeClientParams = Readonly<{
  bus: AutoBridgeBus;
  newId: () => string;
  timeoutMs?: number;
}>;

export type AutoBridgeClient = Readonly<{
  ports: AutoBridgePorts;
  close: () => void;
}>;

type SendParams = {
  readonly call: AutoBridgeCall;
};

type AskParams<Result> = {
  readonly call: AutoBridgeCall;
  readonly isResult: (value: unknown) => value is Result;
};

export const createAutoBridgeClient = async ({
  bus,
  newId,
  timeoutMs = AUTO_BRIDGE_TIMEOUT_MS,
}: AutoBridgeClientParams): Promise<AutoBridgeClient> => {
  const pending = new Map<string, Pending>();
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
  const send = ({ call }: SendParams): Promise<unknown> =>
    new Promise<unknown>((resolve, reject) => {
      const id = newId();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(NO_ANSWER));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      const request: AutoBridgeRequest = { id, call };
      bus.emit({ event: AUTO_BRIDGE_EVENT.request, payload: request }).catch((error: unknown) => {
        pending.delete(id);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(NO_ANSWER));
      });
    });
  const ask = async <Result>({ call, isResult }: AskParams<Result>): Promise<Result> => {
    const result = await send({ call });
    if (!isResult(result)) {
      throw new Error(NO_ANSWER);
    }
    return result;
  };
  const ports: AutoBridgePorts = {
    stop: ({ treeId }) => ask({ call: { kind: 'stop', treeId }, isResult: isStopResult }),
    retry: ({ treeId }) => ask({ call: { kind: 'retry', treeId }, isResult: isRetryResult }),
    decision: ({ delegationId, decision }) =>
      ask({ call: { kind: 'decision', delegationId, decision }, isResult: isDecisionResult }),
    userTurn: (turn) =>
      ask({ call: { kind: 'userTurn', turn }, isResult: isTurnResult }).catch(
        (): AutoUserTurnResult => 'lost',
      ),
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
