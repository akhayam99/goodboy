import { invoke, type InvokeArgs, type InvokeOptions } from '@tauri-apps/api/core';
import { formatError } from '@goodboy/ui';

const UNKNOWN_KIND = 'unknown';

type Params = {
  readonly kind: string;
  readonly message: string;
  readonly cause?: unknown;
};

export class CommandError extends Error {
  readonly kind: string;

  constructor({ kind, message, cause }: Params) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'CommandError';
    this.kind = kind;
  }

  toJSON() {
    return { kind: this.kind, message: this.message };
  }
}

const kindOf = (rejection: unknown): string => {
  if (typeof rejection !== 'object' || rejection === null) {
    return UNKNOWN_KIND;
  }
  const kind: unknown = Reflect.get(rejection, 'kind');
  return typeof kind === 'string' && kind !== '' ? kind : UNKNOWN_KIND;
};

export const toCommandError = (rejection: unknown): CommandError => {
  if (rejection instanceof CommandError) {
    return rejection;
  }
  return new CommandError({
    kind: kindOf(rejection),
    message: formatError(rejection),
    cause: rejection,
  });
};

type Rest = [args?: InvokeArgs, options?: InvokeOptions];

export const invokeCommand = async <T>(command: string, ...rest: Rest): Promise<T> => {
  try {
    return await invoke<T>(command, ...rest);
  } catch (rejection: unknown) {
    throw toCommandError(rejection);
  }
};
