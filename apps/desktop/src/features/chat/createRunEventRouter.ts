import { listen, type UnlistenFn } from '@tauri-apps/api/event';

type RunEnvelope = {
  readonly runId: string;
};

type RouterParams = {
  readonly eventName: string;
};

type Delivery<Envelope extends RunEnvelope> = {
  readonly envelope: Envelope;
};

type Handler<Envelope extends RunEnvelope> = (delivery: Delivery<Envelope>) => void;

type Subscription<Envelope extends RunEnvelope> = {
  readonly runId: string;
  readonly handler: Handler<Envelope>;
};

type Flags = {
  isClosed: boolean;
  stop: UnlistenFn | null;
};

type Listening = {
  readonly flags: Flags;
  readonly ready: Promise<void>;
};

export type RunEventRouter<Envelope extends RunEnvelope> = {
  readonly subscribe: (params: Subscription<Envelope>) => Promise<() => void>;
};

export const createRunEventRouter = <Envelope extends RunEnvelope>({
  eventName,
}: RouterParams): RunEventRouter<Envelope> => {
  const handlers = new Map<string, Set<Handler<Envelope>>>();
  let current: Listening | null = null;

  const dispatch = ({ envelope }: Delivery<Envelope>): void => {
    const targets = handlers.get(envelope.runId);
    if (targets === undefined) {
      return;
    }
    for (const handler of [...targets]) {
      handler({ envelope });
    }
  };

  const install = (): Listening => {
    const flags: Flags = { isClosed: false, stop: null };
    const ready = listen<Envelope>(eventName, (event) => {
      if (flags.isClosed) {
        return;
      }
      dispatch({ envelope: event.payload });
    }).then((unlisten) => {
      if (flags.isClosed) {
        unlisten();
        return;
      }
      flags.stop = unlisten;
    });
    return { flags, ready };
  };

  const closeWhenEmpty = (): void => {
    if (handlers.size > 0 || current === null) {
      return;
    }
    const closing = current;
    current = null;
    closing.flags.isClosed = true;
    closing.flags.stop?.();
  };

  const remove = ({ runId, handler }: Subscription<Envelope>): void => {
    const targets = handlers.get(runId);
    targets?.delete(handler);
    if (targets?.size === 0) {
      handlers.delete(runId);
    }
    closeWhenEmpty();
  };

  return {
    subscribe: async ({ runId, handler }) => {
      const targets = handlers.get(runId) ?? new Set();
      targets.add(handler);
      handlers.set(runId, targets);
      current ??= install();
      const listening = current;
      try {
        await listening.ready;
      } catch (error) {
        remove({ runId, handler });
        throw error;
      }
      return () => remove({ runId, handler });
    },
  };
};
