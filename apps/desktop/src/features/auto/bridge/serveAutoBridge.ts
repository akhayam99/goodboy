import { formatError } from '@goodboy/ui';
import {
  AUTO_BRIDGE_EVENT,
  type AutoBridgeBus,
  type AutoBridgeCall,
  type AutoBridgePorts,
  type AutoBridgeResponse,
} from './autoBridgeProtocol';
import { isAutoBridgeRequest } from './isAutoBridgeRequest';

type CallParams = {
  readonly ports: AutoBridgePorts;
  readonly call: AutoBridgeCall;
};

const runCall = async ({ ports, call }: CallParams): Promise<unknown> => {
  switch (call.kind) {
    case 'stop':
      return ports.stop({ treeId: call.treeId });
    case 'retry':
      return ports.retry({ treeId: call.treeId });
    case 'userTurn':
      return ports.userTurn(call.turn);
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

export const serveAutoBridge = ({ bus, ports, onError }: ServeParams): Promise<() => void> =>
  bus.listen({
    event: AUTO_BRIDGE_EVENT.request,
    onPayload: (payload) => {
      if (!isAutoBridgeRequest(payload)) {
        return;
      }
      const { id, call } = payload;
      void runCall({ ports, call })
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
