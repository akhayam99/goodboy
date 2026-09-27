import { useEffect, useLayoutEffect } from 'react';

export type FakeArgs = Readonly<Record<string, unknown>> | undefined;

export type FakeHandlers = Readonly<Record<string, (args: FakeArgs) => unknown>>;

type FakeInternals = Readonly<{
  invoke: (command: string, args?: FakeArgs) => Promise<unknown>;
  transformCallback: () => number;
  unregisterCallback: () => void;
  convertFileSrc: (path: string) => string;
}>;

type TauriWindow = Window & { __TAURI_INTERNALS__?: FakeInternals };

const internalsOf = ({ handlers }: { readonly handlers: FakeHandlers }): FakeInternals => ({
  invoke: async (command, args) => {
    const handler = handlers[command];
    if (handler === undefined) {
      throw new Error(`${command} is not available in the mock scene`);
    }
    return handler(args);
  },
  transformCallback: () => 0,
  unregisterCallback: () => undefined,
  convertFileSrc: (path) => path,
});

type Params = {
  readonly handlers: FakeHandlers;
  readonly holdMs: number;
};

export const useFakeTauri = ({ handlers, holdMs }: Params): void => {
  useLayoutEffect(() => {
    (window as TauriWindow).__TAURI_INTERNALS__ = internalsOf({ handlers });
  }, [handlers]);

  useEffect(() => {
    const clear = window.setTimeout(() => {
      Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    }, holdMs);
    return () => {
      window.clearTimeout(clear);
      Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    };
  }, [holdMs]);
};
