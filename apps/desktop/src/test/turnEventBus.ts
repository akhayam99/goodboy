import { vi } from 'vitest';

type BusEvent = {
  readonly payload: unknown;
};

type BusHandler = (event: BusEvent) => void;

type EmitParams = {
  readonly payload: unknown;
};

const handlers = new Set<BusHandler>();
let handlerCalls = 0;

export const turnEventBus = {
  listen: vi.fn(async (_name: string, handler: BusHandler): Promise<() => void> => {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }),
  emit: ({ payload }: EmitParams): void => {
    for (const handler of [...handlers]) {
      handlerCalls += 1;
      handler({ payload });
    }
  },
  listenerCount: (): number => handlers.size,
  callCount: (): number => handlerCalls,
  reset: (): void => {
    handlers.clear();
    handlerCalls = 0;
  },
};
