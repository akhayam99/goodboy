type Params = {
  readonly answers: Readonly<Record<string, unknown>>;
};

const INTERNALS_KEY = '__TAURI_INTERNALS__';

export const addDemoOverlay = ({ answers }: Params): void => {
  const internals: unknown = Reflect.get(window, INTERNALS_KEY);
  if (typeof internals !== 'object' || internals === null) {
    return;
  }
  Reflect.set(internals, 'invoke', async (command: string) => answers[command]);
};
