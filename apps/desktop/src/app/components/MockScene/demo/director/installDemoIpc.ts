import { DEMO_PARK, recordDemoMiss } from './recordDemoMiss';
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

const isInvoke = ((value: unknown): value is Invoke => typeof value === 'function') satisfies (
  value: unknown,
) => boolean;

type OverlaySourceParams = {
  readonly value: unknown;
};

const overlayInvokeOf = ({ value }: OverlaySourceParams): Invoke | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const invoke: unknown = Reflect.get(value, 'invoke');
  return isInvoke(invoke) ? invoke : null;
};

type Parked = {
  readonly command: string;
  readonly args: DemoIpcArgs;
  readonly options: unknown;
  readonly resolve: (answer: unknown) => void;
};

type AskParams = {
  readonly overlay: Invoke;
  readonly command: string;
  readonly args: DemoIpcArgs;
  readonly options: unknown;
};

type Answer = {
  readonly isAnswered: boolean;
  readonly answer: unknown;
};

type OverlayParams = {
  readonly overlay: Invoke;
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

  const parked: Array<Parked> = [];

  const ask = async ({ overlay, command, args, options }: AskParams): Promise<Answer> => {
    try {
      const answer: unknown = await overlay(command, args, options);
      if (answer !== undefined && answer !== null) {
        return { isAnswered: true, answer };
      }
      return { isAnswered: answer === null && !DEMO_IPC_HANDLERS.has(command), answer };
    } catch {
      return { isAnswered: false, answer: undefined };
    }
  };

  const invoke = (async (command, args, options) => {
    for (const overlay of [...overlays].reverse()) {
      const reply = await ask({ overlay, command, args, options });
      if (reply.isAnswered) {
        return reply.answer;
      }
    }
    const answer = demoAnswer({ command, args });
    if (answer !== DEMO_PARK) {
      return answer;
    }
    return new Promise((resolve) => {
      parked.push({ command, args, options, resolve });
    });
  }) satisfies Invoke;

  const addOverlay = ({ overlay }: OverlayParams): void => {
    overlays.push(overlay);
    for (const call of [...parked]) {
      void ask({ overlay, command: call.command, args: call.args, options: call.options }).then(
        (reply) => {
          if (!reply.isAnswered || !parked.includes(call)) {
            return;
          }
          parked.splice(parked.indexOf(call), 1);
          call.resolve(reply.answer);
        },
      );
    }
  };

  const internals: DemoInternals & { readonly isGoodboyDemo: true } = {
    isGoodboyDemo: true,
    invoke,
    transformCallback: ((callback, isOnce = false) => {
      const id = nextCallback;
      nextCallback += 1;
      callbacks.set(id, (data) => {
        if (isOnce) {
          callbacks.delete(id);
        }
        return callback?.(data);
      });
      return id;
    }) satisfies DemoInternals['transformCallback'],
    unregisterCallback: ((id) => {
      callbacks.delete(id);
    }) satisfies DemoInternals['unregisterCallback'],
    runCallback: ((id, data) => {
      callbacks.get(id)?.(data);
    }) satisfies DemoInternals['runCallback'],
    convertFileSrc: ((path) => path) satisfies DemoInternals['convertFileSrc'],
    metadata: METADATA,
  };

  Object.defineProperty(internals, 'invoke', {
    configurable: false,
    enumerable: true,
    get: () => invoke,
    set: ((value: unknown) => {
      if (isInvoke(value) && value !== invoke) {
        addOverlay({ overlay: value });
      }
    }) satisfies (value: unknown) => void,
  });

  Object.defineProperty(window, INTERNALS_KEY, {
    configurable: false,
    enumerable: true,
    get: () => internals,
    set: ((value: unknown) => {
      const overlay = overlayInvokeOf({ value });
      if (overlay !== null && overlay !== invoke) {
        addOverlay({ overlay });
      }
    }) satisfies (value: unknown) => void,
  });

  Reflect.set(window, EVENT_INTERNALS_KEY, {
    unregisterListener: ((_event: string, id: number) => {
      callbacks.delete(id);
    }) satisfies (event: string, id: number) => void,
  });
};
