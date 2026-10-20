// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { makeGate } from '../../../../store/slices/auto/testing/makeGate';
import { registerPublishPort, type PublishPort } from '../../publishPort';
import { usePublishAct } from './index';

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
  registerPublishPort({ port: null });
});

const actOnce = async (port: PublishPort | null) => {
  registerPublishPort({ port });
  const { result } = renderHook(() => usePublishAct());
  await act(async () => {
    await result.current.act({
      act: 'confirm',
      delegationIds: ['delegation-a', 'delegation-b'],
      sessionId: SESSION,
    });
  });
  return result;
};

describe('answering a push from the card', () => {
  it('sends the whole batch in one call, then reloads the cards', async () => {
    const port = vi.fn<PublishPort>(async ({ delegationIds }) => ({
      kind: 'done',
      rows: delegationIds.map((delegationId) => ({
        delegationId,
        state: 'pushed' as const,
        message: null,
      })),
    }));

    const result = await actOnce(port);

    expect(port).toHaveBeenCalledOnce();
    expect(port).toHaveBeenCalledWith({
      act: 'confirm',
      delegationIds: ['delegation-a', 'delegation-b'],
    });
    expect(loadAutoTrees).toHaveBeenCalledWith({ sessionId: SESSION });
    expect(reportError).not.toHaveBeenCalled();
    expect(result.current.busyIds).toEqual([]);
  });

  it('marks every branch of the batch busy until the port answers', async () => {
    const gate = makeGate();
    const port = vi.fn<PublishPort>(async () => {
      await gate.promise;
      return { kind: 'done', rows: [] };
    });
    registerPublishPort({ port });
    const { result } = renderHook(() => usePublishAct());

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.act({
        act: 'confirm',
        delegationIds: ['delegation-a', 'delegation-b'],
        sessionId: SESSION,
      });
    });
    expect(result.current.busyIds).toEqual(['delegation-a', 'delegation-b']);
    await act(async () => {
      gate.open();
      await pending;
    });

    expect(result.current.busyIds).toEqual([]);
  });

  it('shows the sentence of each branch that failed or was refused and keeps the ones that worked quiet', async () => {
    const port = vi.fn<PublishPort>(async () => ({
      kind: 'done',
      rows: [
        { delegationId: 'delegation-a', state: 'pushed', message: null },
        {
          delegationId: 'delegation-b',
          state: 'failed',
          message: 'The online copy changed. Check again before force pushing.',
        },
      ],
    }));

    await actOnce(port);

    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't finish the push" }),
    );
    expect(loadAutoTrees).toHaveBeenCalledOnce();
  });

  it('reports a port that throws, frees the buttons and lets the next try go through', async () => {
    const port = vi
      .fn<PublishPort>()
      .mockRejectedValueOnce(new Error('The main window did not answer.'))
      .mockResolvedValueOnce({ kind: 'done', rows: [] });
    registerPublishPort({ port });
    const { result } = renderHook(() => usePublishAct());

    await act(async () => {
      await result.current.act({
        act: 'retry',
        delegationIds: ['delegation-a'],
        sessionId: SESSION,
      });
    });
    expect(reportError).toHaveBeenCalledOnce();
    expect(result.current.busyIds).toEqual([]);
    await act(async () => {
      await result.current.act({
        act: 'retry',
        delegationIds: ['delegation-a'],
        sessionId: SESSION,
      });
    });

    expect(port).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledOnce();
  });

  it('says so when no window can take the answer yet', async () => {
    await actOnce(null);

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't finish the push" }),
    );
    expect(loadAutoTrees).not.toHaveBeenCalled();
  });
});
