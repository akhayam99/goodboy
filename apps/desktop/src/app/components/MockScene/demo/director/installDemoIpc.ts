import { recordDemoMiss } from './recordDemoMiss';
import { DEMO_IPC_HANDLERS, type DemoIpcArgs } from './demoIpcHandlers';

type Invoke = (command: string, args?: DemoIpcArgs, options?: unknown) => unknown;

type CallbackHandler = (data: unknown) => unknown;

type DemoInternals = {
  invoke: Invoke;
  transformCallback: (callback?: CallbackHandler, isOnce?: boolean) => number;
  unregisterCallback: (id: number) => void;
  runCallback: (id: number, data: unknown) => void;
  convertFileSrc: (path: string) => string;
  metadata: unknown;
};

const INTERNALS_KEY = '__TAURI_INTERNALS__';
const EVENT_INTERNALS_KEY = '__TAURI_EVENT_PLUGIN_INTERNALS__';
const METADATA = {
  currentWindow: { label: 'main' },
  currentWebview: { windowLabel: 'main', label: 'main' },
};

const isInvoke = (value: unknown): value is Invoke => typeof value === 'function';

const overlayInvokeOf = (value: unknown): Invoke | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const invoke: unknown = Reflect.get(value, 'invoke');
  return isInvoke(invoke) ? invoke : null;
};

type AnswerParams = {
  readonly command: string;
  readonly args: DemoIpcArgs;
};

const demoAnswer = ({ command, args }: AnswerParams): unknown => {
  const handler = DEMO_IPC_HANDLERS.get(command);
  if (handler === undefined) {
    return recordDemoMiss({ entry: command });
  }
  return handler(args);
};

const isInstalled = (): boolean => {
  const current: unknown = Reflect.get(window, INTERNALS_KEY);
  return (
    typeof current === 'object' &&
    current !== null &&
    Reflect.get(current, 'isGoodboyDemo') === true
  );
};

export const installDemoIpc = (): void => {
  if (isInstalled()) {
    return;
  }
  const overlays: Array<Invoke> = [];
  const callbacks = new Map<number, CallbackHandler>();
  let nextCallback = 1;

  const invoke: Invoke = async (command, args, options) => {
    for (const overlay of [...overlays].reverse()) {
      try {
        const answer = await overlay(command, args, options);
        if (answer !== undefined && answer !== null) {
          return answer;
        }
        if (answer === null && !DEMO_IPC_HANDLERS.has(command)) {
          return answer;
        }
      } catch {
        continue;
      }
    }
    return demoAnswer({ command, args });
  };

  const internals: DemoInternals & { readonly isGoodboyDemo: true } = {
    isGoodboyDemo: true,
    invoke,
    transformCallback: (callback, isOnce = false) => {
      const id = nextCallback;
      nextCallback += 1;
      callbacks.set(id, (data) => {
        if (isOnce) {
          callbacks.delete(id);
        }
        return callback?.(data);
      });
      return id;
    },
    unregisterCallback: (id) => {
      callbacks.delete(id);
    },
    runCallback: (id, data) => {
      callbacks.get(id)?.(data);
    },
    convertFileSrc: (path) => path,
    metadata: METADATA,
  };

  Object.defineProperty(internals, 'invoke', {
    configurable: false,
    enumerable: true,
    get: () => invoke,
    set: (value: unknown) => {
      if (isInvoke(value) && value !== invoke) {
        overlays.push(value);
      }
    },
  });

  Object.defineProperty(window, INTERNALS_KEY, {
    configurable: false,
    enumerable: true,
    get: () => internals,
    set: (value: unknown) => {
      const overlay = overlayInvokeOf(value);
      if (overlay !== null && overlay !== invoke) {
        overlays.push(overlay);
      }
    },
  });

  Reflect.set(window, EVENT_INTERNALS_KEY, {
    unregisterListener: (_event: string, id: number) => {
      callbacks.delete(id);
    },
  });
};
