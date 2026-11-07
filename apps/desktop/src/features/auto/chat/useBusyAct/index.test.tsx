// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useAppStore } from '../../../../store';
import { makeGate } from '../../../../store/runtime/auto/testing/makeGate';
import { useBusyAct } from './index';

type TestPort = (params: { readonly value: number }) => Promise<void>;

const TITLE = "Couldn't do it";
const NOT_READY = 'Not ready yet.';

const reportError = vi.fn(async () => undefined);

beforeEach(() => {
  reportError.mockClear();
  useAppStore.setState({ reportError });
});

afterEach(() => {
  cleanup();
});

type HookParams = {
  readonly port: TestPort | null;
};

const hookOf = ({ port }: HookParams) =>
  renderHook(() =>
    useBusyAct<TestPort>({ title: TITLE, notReadyMessage: NOT_READY, currentPort: () => port }),
  );

describe('the busy act of an Auto port', () => {
  it('reports the not ready sentence and stays idle when no port is registered', async () => {
    const work = vi.fn(async () => undefined);
    const { result } = hookOf({ port: null });

    await act(async () => {
      await result.current.run({ busyIds: ['row-a'], work });
    });

    expect(work).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith({ title: TITLE, error: new Error(NOT_READY) });
    expect(result.current.busyIds).toEqual([]);
  });

  it('marks the ids busy until the work ends, then frees only those ids', async () => {
    const gate = makeGate();
    const port = vi.fn<TestPort>(async () => undefined);
    const { result } = hookOf({ port });

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.run({
        busyIds: ['row-a', 'row-b'],
        work: async () => {
          await gate.promise;
        },
      });
      second = result.current.run({ busyIds: ['row-c'], work: async () => undefined });
    });
    await act(async () => {
      await second;
    });

    expect(result.current.busyIds).toEqual(['row-a', 'row-b']);

    gate.open();
    await act(async () => {
      await first;
    });

    expect(result.current.busyIds).toEqual([]);
  });

  it('hands the registered port to the work', async () => {
    const port = vi.fn<TestPort>(async () => undefined);
    const { result } = hookOf({ port });

    await act(async () => {
      await result.current.run({
        busyIds: ['row-a'],
        work: async ({ port: given }) => {
          await given({ value: 3 });
        },
      });
    });

    expect(port).toHaveBeenCalledWith({ value: 3 });
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports the error of a failing work and frees the ids', async () => {
    const failure = new Error('the push was refused');
    const { result } = hookOf({ port: async () => undefined });

    await act(async () => {
      await result.current.run({
        busyIds: ['row-a'],
        work: async () => {
          throw failure;
        },
      });
    });

    expect(reportError).toHaveBeenCalledWith({ title: TITLE, error: failure });
    expect(result.current.busyIds).toEqual([]);
  });
});
