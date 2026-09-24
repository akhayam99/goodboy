import { describe, expect, it } from 'vitest';
import { createKeyedQueue } from './keyedQueue';

type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
};

const deferred = (): Deferred => {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

const flush = async () => {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
};

describe('createKeyedQueue', () => {
  it('runs tasks for one key in submission order', async () => {
    const queue = createKeyedQueue();
    const events: string[] = [];
    const gate = deferred();

    const first = queue.run({
      key: 'a',
      task: async () => {
        events.push('first:start');
        await gate.promise;
        events.push('first:end');
      },
    });
    const second = queue.run({
      key: 'a',
      task: async () => {
        events.push('second');
      },
    });
    await flush();
    expect(events).toEqual(['first:start']);

    gate.resolve();
    await Promise.all([first, second]);
    expect(events).toEqual(['first:start', 'first:end', 'second']);
  });

  it('never lets a slow key hold back another key', async () => {
    const queue = createKeyedQueue();
    const gate = deferred();
    const slow = queue.run({ key: 'a', task: () => gate.promise });

    await expect(queue.run({ key: 'b', task: async () => 'fast' })).resolves.toBe('fast');

    gate.resolve();
    await slow;
  });

  it('keeps the chain going after a task rejects', async () => {
    const queue = createKeyedQueue();
    const failing = queue.run({
      key: 'a',
      task: async () => {
        throw new Error('boom');
      },
    });
    const next = queue.run({ key: 'a', task: async () => 'after' });

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('after');
  });

  it('starts a fresh chain once the tail settles', async () => {
    const queue = createKeyedQueue();
    const events: string[] = [];
    await queue.run({
      key: 'a',
      task: async () => {
        events.push('one');
      },
    });
    const gate = deferred();
    const blocked = queue.run({ key: 'a', task: () => gate.promise });
    const waiting = queue.run({
      key: 'a',
      task: async () => {
        events.push('two');
      },
    });
    await flush();
    expect(events).toEqual(['one']);

    gate.resolve();
    await Promise.all([blocked, waiting]);
    expect(events).toEqual(['one', 'two']);
  });
});
