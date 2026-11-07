// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  importStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { makeGate } from '../../../../store/runtime/auto/testing/makeGate';
import {
  registerDelegationDecisionPort,
  type DelegationDecisionPort,
} from '../../delegationDecisionPort';
import { useDelegationDecision } from './index';

let useAppStore: StoryStore;

const reportError = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  reportError.mockClear();
  useAppStore.setState({ reportError });
});

afterEach(() => {
  cleanup();
  registerDelegationDecisionPort({ port: null });
});

describe('answering an Auto question', () => {
  it('marks the question busy until the port answers', async () => {
    const gate = makeGate();
    registerDelegationDecisionPort({
      port: async () => {
        await gate.promise;
        return 'confirmed';
      },
    });
    const { result } = renderHook(() => useDelegationDecision());

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.decide({ delegationId: 'delegation-export', decision: 'confirm' });
    });
    expect(result.current.busyId).toBe('delegation-export');

    gate.open();
    await act(async () => {
      await pending;
    });

    expect(result.current.busyId).toBeNull();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('says the question is closed when the port lost it', async () => {
    registerDelegationDecisionPort({ port: async () => 'lost' });
    const { result } = renderHook(() => useDelegationDecision());

    await act(async () => {
      await result.current.decide({ delegationId: 'delegation-export', decision: 'decline' });
    });

    expect(reportError).toHaveBeenCalledWith({
      title: 'Auto has already moved on',
      error: new Error('This question is no longer open.'),
    });
    expect(result.current.busyId).toBeNull();
  });

  it('reports the error of a failing port and frees the question', async () => {
    const failure = new Error('the bridge dropped');
    const port: DelegationDecisionPort = async () => {
      throw failure;
    };
    registerDelegationDecisionPort({ port });
    const { result } = renderHook(() => useDelegationDecision());

    await act(async () => {
      await result.current.decide({ delegationId: 'delegation-export', decision: 'confirm' });
    });

    expect(reportError).toHaveBeenCalledWith({ title: "Couldn't answer Auto", error: failure });
    expect(result.current.busyId).toBeNull();
  });

  it('says Auto cannot take the answer when no port is registered', async () => {
    const { result } = renderHook(() => useDelegationDecision());

    await act(async () => {
      await result.current.decide({ delegationId: 'delegation-export', decision: 'confirm' });
    });

    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't answer Auto",
      error: new Error("Auto can't take this answer here yet."),
    });
    expect(result.current.busyId).toBeNull();
  });
});
