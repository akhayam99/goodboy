import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRunEventRouter } from './createRunEventRouter';

type Envelope = {
  readonly runId: string;
  readonly line: string;
};

type Callback = (event: { payload: Envelope }) => void;

const { callbacks, unlistenMock, listenMock } = vi.hoisted(() => ({
  callbacks: new Array<Callback>(),
  unlistenMock: vi.fn(),
  listenMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

const answerImmediately = (): void => {
  listenMock.mockImplementation(async (_name: string, callback: Callback) => {
    callbacks.push(callback);
    return unlistenMock;
  });
};

const deliver = (envelope: Envelope): void => {
  callbacks.forEach((callback) => callback({ payload: envelope }));
};

afterEach(() => {
  callbacks.length = 0;
  vi.clearAllMocks();
  listenMock.mockReset();
});

describe('createRunEventRouter', () => {
  it('listens once for eight runs and routes each envelope to its own run', async () => {
    answerImmediately();
    const router = createRunEventRouter<Envelope>({ eventName: 'turn_event' });
    const seen = new Map<string, string[]>();
    const runIds = Array.from({ length: 8 }, (_, index) => `run-${index}`);

    await Promise.all(
      runIds.map((runId) =>
        router.subscribe({
          runId,
          handler: ({ envelope }) => seen.set(runId, [...(seen.get(runId) ?? []), envelope.line]),
        }),
      ),
    );
    deliver({ runId: 'run-3', line: 'for run three' });
    deliver({ runId: 'run-unknown', line: 'for nobody' });

    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(listenMock).toHaveBeenCalledWith('turn_event', expect.any(Function));
    expect([...seen.entries()]).toEqual([['run-3', ['for run three']]]);
  });

  it('stops listening when the last run leaves and listens again for the next one', async () => {
    answerImmediately();
    const router = createRunEventRouter<Envelope>({ eventName: 'turn_event' });
    const first = await router.subscribe({ runId: 'run-a', handler: vi.fn() });
    const second = await router.subscribe({ runId: 'run-b', handler: vi.fn() });

    first();
    expect(unlistenMock).not.toHaveBeenCalled();
    second();
    expect(unlistenMock).toHaveBeenCalledOnce();

    const handler = vi.fn();
    await router.subscribe({ runId: 'run-c', handler });
    expect(listenMock).toHaveBeenCalledTimes(2);
    deliver({ runId: 'run-c', line: 'once' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('drops a late envelope from a listener that was already closed', async () => {
    answerImmediately();
    const router = createRunEventRouter<Envelope>({ eventName: 'turn_event' });
    const closed = await router.subscribe({ runId: 'run-a', handler: vi.fn() });
    const staleCallback = callbacks[0]!;
    closed();

    const handler = vi.fn();
    await router.subscribe({ runId: 'run-a', handler });
    staleCallback({ payload: { runId: 'run-a', line: 'late' } });
    deliver({ runId: 'run-a', line: 'live' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ envelope: { runId: 'run-a', line: 'live' } });
  });

  it('hands every handler of the same run its envelopes', async () => {
    answerImmediately();
    const router = createRunEventRouter<Envelope>({ eventName: 'turn_event' });
    const one = vi.fn();
    const two = vi.fn();
    await router.subscribe({ runId: 'run-a', handler: one });
    await router.subscribe({ runId: 'run-a', handler: two });

    deliver({ runId: 'run-a', line: 'both' });

    expect(one).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledTimes(1);
  });

  it('rejects the subscription when listening fails and tries again on the next one', async () => {
    listenMock.mockRejectedValueOnce(new Error('event bus unavailable'));
    const router = createRunEventRouter<Envelope>({ eventName: 'turn_event' });
    const failed = vi.fn();

    await expect(router.subscribe({ runId: 'run-a', handler: failed })).rejects.toThrow(
      'event bus unavailable',
    );
    answerImmediately();
    const handler = vi.fn();
    await router.subscribe({ runId: 'run-a', handler });
    deliver({ runId: 'run-a', line: 'after the retry' });

    expect(failed).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
