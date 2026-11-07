// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { WorkflowAutonomy } from '@goodboy/types';
import { makeGate } from '../../../store/runtime/auto/testing/makeGate';
import { useAutonomyPick } from './index';

type SaveParams = {
  readonly next: WorkflowAutonomy;
};

type SaveFn = (params: SaveParams) => Promise<void>;

describe('picking when a run asks', () => {
  it('saves the new choice and goes idle again', async () => {
    const save = vi.fn<SaveFn>(async () => undefined);
    const { result } = renderHook(() => useAutonomyPick({ current: 'step', save }));

    await act(async () => {
      await result.current.pick({ next: 'run' });
    });

    expect(save).toHaveBeenCalledWith({ next: 'run' });
    expect(result.current.isBusy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does nothing when the choice is already the current one', async () => {
    const save = vi.fn<SaveFn>(async () => undefined);
    const { result } = renderHook(() => useAutonomyPick({ current: 'step', save }));

    await act(async () => {
      await result.current.pick({ next: 'step' });
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('is busy while the save is pending and ignores a second pick', async () => {
    const gate = makeGate();
    const save = vi.fn<SaveFn>(async () => {
      await gate.promise;
    });
    const { result } = renderHook(() => useAutonomyPick({ current: 'step', save }));

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.pick({ next: 'run' });
    });
    expect(result.current.isBusy).toBe(true);

    await act(async () => {
      await result.current.pick({ next: 'plan' });
    });
    expect(save).toHaveBeenCalledTimes(1);

    gate.open();
    await act(async () => {
      await first;
    });
    expect(result.current.isBusy).toBe(false);
  });

  it('shows what went wrong, frees the chip and clears the error on the next try', async () => {
    const save = vi
      .fn<SaveFn>()
      .mockRejectedValueOnce(new Error('the database is locked'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAutonomyPick({ current: 'step', save }));

    await act(async () => {
      await result.current.pick({ next: 'run' });
    });
    expect(result.current.error).toBe("Couldn't change it. the database is locked");
    expect(result.current.isBusy).toBe(false);

    await act(async () => {
      await result.current.pick({ next: 'run' });
    });
    expect(result.current.error).toBeNull();
  });
});
