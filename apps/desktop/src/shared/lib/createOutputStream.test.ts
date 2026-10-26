// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOutputStream } from './createOutputStream';

type Handler = (event: { payload: unknown }) => void;

const { listenMock, handlers } = vi.hoisted(() => ({
  listenMock: vi.fn(),
  handlers: new Map<string, Handler>(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

type OutputPayload = {
  readonly runId: string;
  readonly data: string;
  readonly offset?: number;
};

type ExitPayload = {
  readonly runId: string;
  readonly exitCode: number;
};

type EmitParams = {
  readonly runId: string;
  readonly text: string;
  readonly offset?: number;
};

type ExitParams = {
  readonly runId: string;
  readonly exitCode: number;
};

const answerAll = (): void => {
  listenMock.mockImplementation(async (name: string, handler: Handler) => {
    handlers.set(name, handler);
    return () => undefined;
  });
};

const emitOutput = ({ runId, text, offset }: EmitParams): void => {
  handlers.get('stream-output')?.({
    payload: { runId, data: btoa(text), ...(offset === undefined ? {} : { offset }) },
  });
};

const emitExit = ({ runId, exitCode }: ExitParams): void => {
  handlers.get('stream-exit')?.({ payload: { runId, exitCode } });
};

const textOf = (bytes: Uint8Array | undefined): string =>
  bytes === undefined ? '' : new TextDecoder().decode(bytes);

const startedStream = () =>
  createOutputStream<'runId', OutputPayload, ExitPayload>({
    outputEvent: 'stream-output',
    exitEvent: 'stream-exit',
    idField: 'runId',
    isStartRequired: true,
    keptExited: 2,
  });

const looseStream = () =>
  createOutputStream<'runId', OutputPayload, ExitPayload>({
    outputEvent: 'stream-output',
    exitEvent: 'stream-exit',
    idField: 'runId',
    isStartRequired: false,
  });

afterEach(() => {
  handlers.clear();
  listenMock.mockReset();
});

describe('createOutputStream', () => {
  it('installs one listener for the output and one for the exit however it is used', async () => {
    answerAll();
    const stream = startedStream();

    await stream.register();
    await stream.register();
    await stream.start({ id: 'run-1' });
    await stream.start({ id: 'run-2' });
    stream.subscribe({ id: 'run-1', subscriber: { onOutput: vi.fn() } });
    stream.subscribe({ id: 'run-2', subscriber: { onExit: vi.fn() } });
    stream.listenAll({ onOutput: vi.fn() });
    stream.listenAll({ onExit: vi.fn() });

    expect(listenMock).toHaveBeenCalledTimes(2);
    expect(listenMock).toHaveBeenCalledWith('stream-output', expect.any(Function));
    expect(listenMock).toHaveBeenCalledWith('stream-exit', expect.any(Function));
  });

  it('tries again to install after a failed registration', async () => {
    listenMock.mockRejectedValueOnce(new Error('event bus unavailable'));
    answerAll();
    const stream = startedStream();

    await expect(stream.register()).rejects.toThrow('event bus unavailable');
    await expect(stream.register()).resolves.toBeUndefined();
  });

  it('detaches the listener that attached when the other one fails, so a retry does not double the output', async () => {
    const detached: string[] = [];
    listenMock.mockImplementationOnce(async (name: string, handler: Handler) => {
      handlers.set(name, handler);
      return () => {
        detached.push(name);
      };
    });
    listenMock.mockRejectedValueOnce(new Error('event bus unavailable'));
    const stream = startedStream();

    await expect(stream.start({ id: 'run-1' })).rejects.toThrow('event bus unavailable');
    expect(detached).toEqual(['stream-output']);

    answerAll();
    await stream.start({ id: 'run-1' });
    emitOutput({ runId: 'run-1', text: 'once' });

    expect(textOf(stream.snapshotOf({ id: 'run-1' })?.bytes)).toBe('once');
  });

  it('counts offsets itself when the payload has none and keeps the text in order', async () => {
    answerAll();
    const stream = startedStream();
    await stream.start({ id: 'run-1' });

    emitOutput({ runId: 'run-1', text: 'install ' });
    emitOutput({ runId: 'run-1', text: 'done' });

    const snapshot = stream.snapshotOf({ id: 'run-1' });
    expect(textOf(snapshot?.bytes)).toBe('install done');
    expect(snapshot).toMatchObject({ offset: 0, exitCode: null });
  });

  it('keeps the last 256KB and the offset of its first byte', async () => {
    answerAll();
    const stream = startedStream();
    await stream.start({ id: 'run-1' });
    const block = 'x'.repeat(1024);

    for (let index = 0; index < 1024; index++) {
      emitOutput({ runId: 'run-1', text: block });
    }

    const snapshot = stream.snapshotOf({ id: 'run-1' });
    expect(snapshot?.bytes.length).toBe(262_144);
    expect(snapshot?.offset).toBe(1_048_576 - 262_144);
  });

  it('ignores a run it was not told to start when a start is required', async () => {
    answerAll();
    const stream = startedStream();
    await stream.register();
    const subscriber = vi.fn();
    stream.subscribe({ id: 'run-9', subscriber: { onOutput: subscriber, onExit: subscriber } });

    emitOutput({ runId: 'run-9', text: 'stray' });
    emitExit({ runId: 'run-9', exitCode: 0 });

    expect(stream.snapshotOf({ id: 'run-9' })).toBeNull();
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('opens a buffer on the first output of an unknown id when no start is required', async () => {
    answerAll();
    const stream = looseStream();
    await stream.register();

    emitOutput({ runId: 'terminal-1', text: 'ls', offset: 40 });

    const snapshot = stream.snapshotOf({ id: 'terminal-1' });
    expect(textOf(snapshot?.bytes)).toBe('ls');
    expect(snapshot?.offset).toBe(40);
  });

  it('hands an exit once to the subscribers of that run and to the exit listeners', async () => {
    answerAll();
    const stream = startedStream();
    await stream.start({ id: 'run-1' });
    const mine = vi.fn();
    const other = vi.fn();
    const everyExit = vi.fn();
    stream.subscribe({ id: 'run-1', subscriber: { onExit: mine } });
    stream.subscribe({ id: 'run-2', subscriber: { onExit: other } });
    stream.subscribeExits({ listener: everyExit });

    emitExit({ runId: 'run-1', exitCode: 3 });

    expect(mine).toHaveBeenCalledTimes(1);
    expect(mine).toHaveBeenCalledWith(3);
    expect(other).not.toHaveBeenCalled();
    expect(everyExit).toHaveBeenCalledWith({ id: 'run-1', exitCode: 3 });
    expect(stream.snapshotOf({ id: 'run-1' })?.exitCode).toBe(3);
  });

  it('lets a wildcard listener see every run and stop listening', async () => {
    answerAll();
    const stream = startedStream();
    await stream.register();
    const seen = vi.fn();

    const stop = stream.listenAll({ onOutput: seen });
    emitOutput({ runId: 'run-1', text: 'a' });
    emitOutput({ runId: 'run-2', text: 'b' });
    stop();
    emitOutput({ runId: 'run-1', text: 'c' });

    expect(seen).toHaveBeenCalledTimes(2);
    expect(seen.mock.calls.map((call) => call[0].runId)).toEqual(['run-1', 'run-2']);
  });

  it('keeps only the newest exited runs and frees a released one', async () => {
    answerAll();
    const stream = startedStream();
    for (const id of ['run-1', 'run-2', 'run-3']) {
      await stream.start({ id });
      emitExit({ runId: id, exitCode: 0 });
    }

    expect(stream.snapshotOf({ id: 'run-1' })).toBeNull();
    expect(stream.snapshotOf({ id: 'run-2' })).not.toBeNull();
    stream.release({ id: 'run-2' });
    expect(stream.snapshotOf({ id: 'run-2' })).toBeNull();
    await stream.start({ id: 'run-4' });
    stream.release({ id: 'run-4' });
    expect(stream.snapshotOf({ id: 'run-4' })).not.toBeNull();
  });
});
