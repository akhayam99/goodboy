import { formatError } from '@goodboy/ui';
import type { AutoUserTurnParams, AutoUserTurnResult } from '../autoUserTurnPort';
import {
  AUTO_BRIDGE_EVENT,
  type AutoBridgeBus,
  type AutoBridgeCall,
  type AutoBridgePorts,
  type AutoBridgeResponse,
} from './autoBridgeProtocol';
import { isAutoBridgeRequest } from './isAutoBridgeRequest';

const TURN_MEMORY_MS = 10 * 60_000;

type TurnSeen = {
  readonly result: Promise<AutoUserTurnResult>;
  readonly atMs: number;
};

type TurnMemory = Map<string, TurnSeen>;

type TurnParams = {
  readonly ports: AutoBridgePorts;
  readonly turns: TurnMemory;
  readonly messageId: string;
  readonly turn: AutoUserTurnParams;
};

type ForgetParams = {
  readonly turns: TurnMemory;
};

const forgetOldTurns = ({ turns }: ForgetParams): void => {
  const oldestMs = Date.now() - TURN_MEMORY_MS;
  for (const [messageId, seen] of turns) {
    if (seen.atMs < oldestMs) {
      turns.delete(messageId);
    }
  }
};

const runTurnOnce = ({
  ports,
  turns,
  messageId,
  turn,
}: TurnParams): Promise<AutoUserTurnResult> => {
  forgetOldTurns({ turns });
  const seen = turns.get(messageId);
  if (seen !== undefined) {
    return seen.result;
  }
  const result = ports.userTurn(turn);
  turns.set(messageId, { result, atMs: Date.now() });
  const forget = (): void => {
    turns.delete(messageId);
  };
  result.then((outcome) => {
    if (outcome === 'lost') {
      forget();
    }
  }, forget);
  return result;
};

type CallParams = {
  readonly ports: AutoBridgePorts;
  readonly turns: TurnMemory;
  readonly call: AutoBridgeCall;
};

const runCall = async ({ ports, turns, call }: CallParams): Promise<unknown> => {
  switch (call.kind) {
    case 'stop':
      return ports.stop({ treeId: call.treeId });
    case 'retry':
      return ports.retry({ treeId: call.treeId });
    case 'userTurn':
      return runTurnOnce({ ports, turns, messageId: call.messageId, turn: call.turn });
    case 'decision':
      return ports.decision({ delegationId: call.delegationId, decision: call.decision });
    default: {
      const unreachable: never = call;
      return unreachable;
    }
  }
};

type ServeParams = {
  readonly bus: AutoBridgeBus;
  readonly ports: AutoBridgePorts;
  readonly onError: (error: unknown) => void;
};

export const serveAutoBridge = ({ bus, ports, onError }: ServeParams): Promise<() => void> => {
  const turns: TurnMemory = new Map();
  return bus.listen({
    event: AUTO_BRIDGE_EVENT.request,
    onPayload: (payload) => {
      if (!isAutoBridgeRequest(payload)) {
        return;
      }
      const { id, call } = payload;
      void runCall({ ports, turns, call })
        .then((result): AutoBridgeResponse => ({ id, isOk: true, result }))
        .catch((error: unknown): AutoBridgeResponse => ({
          id,
          isOk: false,
          error: formatError(error),
        }))
        .then((response) => bus.emit({ event: AUTO_BRIDGE_EVENT.response, payload: response }))
        .catch(onError);
    },
  });
};
