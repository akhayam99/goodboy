// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createLatestOnly } from './latestOnly';

type Deferred<Value> = {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
  readonly reject: (error: Error) => void;
};

const deferred = <Value>(): Deferred<Value> => {
  let resolve: (value: Value) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

describe('latestOnly keeps the answer to the newest request for a key', () => {
  it('applies a result when nothing newer was asked', async () => {
    const latest = createLatestOnly();
    const applied: string[] = [];

    const outcome = await latest.run({
      key: 'issues',
      request: async () => 'first',
      apply: (value) => applied.push(value),
    });

    expect(outcome).toBe('applied');
    expect(applied).toEqual(['first']);
  });

  it('drops a late answer when a newer request for the same key was started', async () => {
    const latest = createLatestOnly();
    const older = deferred<string>();
    const newer = deferred<string>();
    const applied: string[] = [];

    const first = latest.run({
      key: 'issues',
      request: () => older.promise,
      apply: (value) => applied.push(value),
    });
    const second = latest.run({
      key: 'issues',
      request: () => newer.promise,
      apply: (value) => applied.push(value),
    });
    newer.resolve('newer');
    older.resolve('older');

    expect(await second).toBe('applied');
    expect(await first).toBe('stale');
    expect(applied).toEqual(['newer']);
  });

  it('keeps tokens apart per key', async () => {
    const latest = createLatestOnly();
    const applied: string[] = [];

    await Promise.all([
      latest.run({ key: 'a', request: async () => 'a', apply: (value) => applied.push(value) }),
      latest.run({ key: 'b', request: async () => 'b', apply: (value) => applied.push(value) }),
    ]);

    expect(applied.sort()).toEqual(['a', 'b']);
  });

  it('drops the error of a request that is no longer the latest', async () => {
    const latest = createLatestOnly();
    const older = deferred<string>();
    const applied: string[] = [];

    const first = latest.run({
      key: 'issues',
      request: () => older.promise,
      apply: (value) => applied.push(value),
    });
    await latest.run({
      key: 'issues',
      request: async () => 'newer',
      apply: (value) => applied.push(value),
    });
    older.reject(new Error('timeout'));

    expect(await first).toBe('stale');
    expect(applied).toEqual(['newer']);
  });

  it('raises the error of the latest request', async () => {
    const latest = createLatestOnly();

    await expect(
      latest.run({
        key: 'issues',
        request: async () => {
          throw new Error('offline');
        },
        apply: () => undefined,
      }),
    ).rejects.toThrow('offline');
  });

  it('cancels a pending request so its answer is dropped', async () => {
    const latest = createLatestOnly();
    const pending = deferred<string>();
    const applied: string[] = [];

    const run = latest.run({
      key: 'issues',
      request: () => pending.promise,
      apply: (value) => applied.push(value),
    });
    latest.cancel({ key: 'issues' });
    pending.resolve('late');

    expect(await run).toBe('stale');
    expect(applied).toEqual([]);
  });
});
