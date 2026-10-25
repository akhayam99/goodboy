// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Message = { readonly payload: { readonly id: string; readonly value: number } };

const { listen, invokeCommand, windowState } = vi.hoisted(() => ({
  listen: vi.fn(async (_event: string, _handler: (message: Message) => void) => () => undefined),
  invokeCommand: vi.fn(async (_command: string, _args: unknown) => undefined),
  windowState: { isMain: true },
}));

vi.mock('@tauri-apps/api/event', () => ({ listen }));
vi.mock('../invokeCommand', () => ({ invokeCommand }));
vi.mock('../../../features/workspace/window', () => ({ isMainWindow: () => windowState.isMain }));

import { serveHandoff } from './index';

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const serve = (
  execute: (request: { readonly id: string; readonly value: number }) => Promise<number>,
) =>
  serveHandoff({
    event: 'query-bridge://demo',
    command: 'demo_result',
    label: 'demo',
    execute,
    replyOf: ({ request, result }) => ({ id: request.id, ok: true, doubled: result * 2 }),
  });

beforeEach(() => {
  Reflect.set(window, '__TAURI_INTERNALS__', {});
  windowState.isMain = true;
});

afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  listen.mockClear();
  invokeCommand.mockClear();
  vi.restoreAllMocks();
});

describe('serveHandoff', () => {
  it('listens to nothing outside the desktop app', async () => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    await serve(async () => 1);
    expect(listen).not.toHaveBeenCalled();
  });

  it('listens to nothing in a window that is not the main one', async () => {
    windowState.isMain = false;
    await serve(async () => 1);
    expect(listen).not.toHaveBeenCalled();
  });

  it('answers a request with the result command, keyed by its id', async () => {
    await serve(async (request) => request.value + 1);
    const handler = listen.mock.calls[0]?.[1];
    handler?.({ payload: { id: 'req-1', value: 20 } });
    await flush();
    expect(listen.mock.calls[0]?.[0]).toBe('query-bridge://demo');
    expect(invokeCommand).toHaveBeenCalledTimes(1);
    expect(invokeCommand).toHaveBeenCalledWith('demo_result', {
      id: 'req-1',
      ok: true,
      doubled: 42,
    });
  });

  it('serves each request on its own and keeps every id', async () => {
    await serve(async (request) => request.value);
    const handler = listen.mock.calls[0]?.[1];
    handler?.({ payload: { id: 'a', value: 1 } });
    handler?.({ payload: { id: 'b', value: 2 } });
    await flush();
    expect(invokeCommand.mock.calls.map((call) => call[1])).toEqual([
      { id: 'a', ok: true, doubled: 2 },
      { id: 'b', ok: true, doubled: 4 },
    ]);
  });

  it('logs a reply that could not be sent, and a failed execute sends no reply', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    invokeCommand.mockRejectedValueOnce(new Error('command is gone'));
    await serve(async () => 1);
    const handler = listen.mock.calls[0]?.[1];
    handler?.({ payload: { id: 'req-1', value: 1 } });
    await flush();
    expect(logged).toHaveBeenCalledWith(
      '[query-bridge] demo result dispatch failed',
      expect.any(Error),
    );
    invokeCommand.mockClear();
    await serve(async () => {
      throw new Error('the work failed');
    });
    const failing = listen.mock.calls[1]?.[1];
    failing?.({ payload: { id: 'req-2', value: 1 } });
    await flush();
    expect(invokeCommand).not.toHaveBeenCalled();
  });
});
