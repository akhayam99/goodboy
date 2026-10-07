type Internals = {
  readonly invoke: (command: string, args?: unknown) => unknown;
};

const isInternals = (value: unknown): value is Internals =>
  typeof value === 'object' &&
  value !== null &&
  'invoke' in value &&
  typeof value.invoke === 'function';

export const sceneInvoke = ({
  command,
  args,
}: {
  readonly command: string;
  readonly args?: unknown;
}): Promise<unknown> => {
  const internals: unknown = Reflect.get(window, '__TAURI_INTERNALS__');
  if (!isInternals(internals)) {
    return new Promise<never>(() => undefined);
  }
  return Promise.resolve(internals.invoke(command, args));
};

export const clearSceneInvoke = (): void => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
};
