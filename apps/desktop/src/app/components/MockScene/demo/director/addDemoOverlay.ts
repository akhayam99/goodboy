type Params = {
  readonly answers: Readonly<Record<string, unknown>>;
};

type Invoke = (command: string, ...rest: ReadonlyArray<unknown>) => Promise<unknown>;

const INTERNALS_KEY = '__TAURI_INTERNALS__';

export const addDemoOverlay = ({ answers }: Params): void => {
  const internals: unknown = Reflect.get(window, INTERNALS_KEY);
  if (typeof internals !== 'object' || internals === null) {
    return;
  }
  const previous = Reflect.get(internals, 'invoke');
  const isDispatcher = Reflect.get(internals, 'isGoodboyDemo') === true;
  const fallback: Invoke | null = typeof previous === 'function' && !isDispatcher ? previous : null;
  Reflect.set(internals, 'invoke', async (command: string, ...rest: ReadonlyArray<unknown>) => {
    if (command in answers) {
      return answers[command];
    }
    return fallback === null ? undefined : fallback(command, ...rest);
  });
};
