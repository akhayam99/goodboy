import { useAppStore } from '../../../store/store';
import { asString } from '../asString';
import { BridgeSafeError } from '../bridgeSafeError';
import { executePhoneAction } from './executePhoneAction';
import { parsePhoneAction, phoneKindOf } from './parsePhoneAction';
import type { StartPorts } from './handlerTypes';
import { startPortsOf } from './startPorts';

type Params = {
  readonly kind: string;
  readonly data: Record<string, unknown>;
  readonly resolveTask: StartPorts['resolveTask'];
};

export const phoneCommand = ({ kind, data, resolveTask }: Params) => {
  if (phoneKindOf({ kind }) === null) {
    throw new BridgeSafeError(`unsupported mobile command: ${kind}`);
  }
  const action = parsePhoneAction({ raw: { ...data, kind } });
  if (action === null) {
    throw new BridgeSafeError(`invalid ${kind} request`);
  }
  return executePhoneAction({
    action,
    phoneId: asString({ value: data.phoneId }) ?? null,
    getStore: () => useAppStore.getState(),
    ports: startPortsOf({ resolveTask }),
  });
};
