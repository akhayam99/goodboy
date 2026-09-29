import { vi } from 'vitest';
import { recordUnexpectedCall } from './unexpectedCalls';

export type InvokeHandlers = Readonly<Record<string, unknown>>;

export const createInvokeRouter =
  ({
    handlers = {},
    unknownResult,
  }: {
    readonly handlers?: InvokeHandlers;
    readonly unknownResult?: unknown;
  } = {}) =>
  async (command?: unknown, args?: unknown): Promise<unknown> => {
    const name = String(command);
    if (!Object.hasOwn(handlers, name)) {
      recordUnexpectedCall({ source: 'invoke', name, args: [args] });
      return unknownResult;
    }
    const handler = handlers[name];
    return typeof handler === 'function' ? handler(args) : handler;
  };

export const createInvokeMock = (options?: Parameters<typeof createInvokeRouter>[0]) =>
  vi.fn(createInvokeRouter(options));
