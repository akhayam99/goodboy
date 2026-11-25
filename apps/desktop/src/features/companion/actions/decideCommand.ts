import { useAppStore } from '../../../store/store';
import { asString } from '../asString';
import { BridgeSafeError } from '../bridgeSafeError';
import { decideKindOf } from './decideAction';
import { decidePorts } from './decidePorts';
import { executeDecideAction } from './executeDecideAction';
import { parseDecideAction } from './parseDecideAction';

type Params = {
  readonly kind: string;
  readonly data: Record<string, unknown>;
};

export const decideCommand = ({ kind, data }: Params) => {
  if (decideKindOf({ kind }) === null) {
    throw new BridgeSafeError(`unsupported mobile command: ${kind}`);
  }
  const action = parseDecideAction({ raw: { ...data, kind } });
  if (action === null) {
    throw new BridgeSafeError(`invalid ${kind} request`);
  }
  return executeDecideAction({
    action,
    phoneId: asString({ value: data.phoneId }) ?? null,
    getStore: () => useAppStore.getState(),
    ports: decidePorts,
  });
};
