// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { makeGate } from '../../../../store/runtime/auto/testing/makeGate';
import { registerChecksRerunPort, type ChecksRerunPort } from '../../checksRerunPort';
import { useChecksRerun } from './index';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

const reportError = vi.fn(async () => undefined);
const loadAutoTrees = vi.fn(async () => undefined);

beforeEach(() => {
  reportError.mockClear();
  loadAutoTrees.mockClear();
  useAppStore.setState({ reportError, loadAutoTrees });
});

afterEach(() => {
  cleanup();
  registerChecksRerunPort({ port: null });
});

const rerunOnce = async (port: ChecksRerunPort | null) => {
  registerChecksRerunPort({ port });
  const { result } = renderHook(() => useChecksRerun());
  await act(async () => {
    await result.current.rerun({ delegationId: 'delegation-export', sessionId: SESSION });
  });
  return result;
};

describe('running the checks of an agent again', () => {
  it('asks the port, then reloads the Auto cards of the session', async () => {
    const port = vi.fn<ChecksRerunPort>(async () => ({ kind: 'rerun', verdict: 'green' }));

    const result = await rerunOnce(port);

    expect(port).toHaveBeenCalledWith({ delegationId: 'delegation-export' });
    expect(loadAutoTrees).toHaveBeenCalledWith({ sessionId: SESSION });
    expect(reportError).not.toHaveBeenCalled();
    expect(result.current.runningId).toBeNull();
  });

  it('marks the delegation as running until the port answers', async () => {
    const gate = makeGate();
    const port = vi.fn<ChecksRerunPort>(async () => {
      await gate.promise;
      return { kind: 'rerun', verdict: 'red' };
    });
    registerChecksRerunPort({ port });
    const { result } = renderHook(() => useChecksRerun());

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.rerun({ delegationId: 'delegation-export', sessionId: SESSION });
    });
    expect(result.current.runningId).toBe('delegation-export');
    await act(async () => {
      gate.open();
      await pending;
    });

    expect(result.current.runningId).toBeNull();
  });

  it('shows the reason of a refusal and still reloads the cards', async () => {
    const port = vi.fn<ChecksRerunPort>(async () => ({
      kind: 'refused',
      message: 'The branch changed after this agent finished.',
    }));

    await rerunOnce(port);

    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't run the checks again",
      error: new Error('The branch changed after this agent finished.'),
    });
    expect(loadAutoTrees).toHaveBeenCalledTimes(1);
  });

  it('shows an error when the main window does not answer, and lets the user try again', async () => {
    const port = vi
      .fn<ChecksRerunPort>()
      .mockRejectedValueOnce(new Error('The main window did not answer.'))
      .mockResolvedValueOnce({ kind: 'rerun', verdict: 'green' });
    registerChecksRerunPort({ port });
    const { result } = renderHook(() => useChecksRerun());

    await act(async () => {
      await result.current.rerun({ delegationId: 'delegation-export', sessionId: SESSION });
    });
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(result.current.runningId).toBeNull();

    await act(async () => {
      await result.current.rerun({ delegationId: 'delegation-export', sessionId: SESSION });
    });
    expect(port).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('says so when Auto is not running in this window yet', async () => {
    await rerunOnce(null);

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(loadAutoTrees).not.toHaveBeenCalled();
  });
});
