import type { InvokeArgs } from '@tauri-apps/api/core';
import { CommandError, invokeCommand } from '../../shared/lib/invokeCommand';
import { historyReasonOf } from './historyReasonOf';

const REASON_KIND = 'reason';

type CopyParams = {
  readonly value: unknown;
};

const copyReasons = ({ value }: CopyParams): void => {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  const reason: unknown = Reflect.get(value, 'reason');
  if (Reflect.get(value, 'kind') === 'blocked' && typeof reason === 'string') {
    Reflect.set(value, 'reason', historyReasonOf({ reason }));
  }
  copyReasons({ value: Reflect.get(value, 'outcome') });
};

type Params = {
  readonly command: string;
  readonly args?: InvokeArgs;
};

export const invokeHistory = async <T>({ command, args }: Params): Promise<T> => {
  try {
    const outcome = await invokeCommand<T>(command, args);
    copyReasons({ value: outcome });
    return outcome;
  } catch (rejection: unknown) {
    if (rejection instanceof CommandError && rejection.kind === REASON_KIND) {
      throw new CommandError({
        kind: rejection.kind,
        message: historyReasonOf({ reason: rejection.message }),
        cause: rejection,
        failure: rejection.failure,
      });
    }
    throw rejection;
  }
};
