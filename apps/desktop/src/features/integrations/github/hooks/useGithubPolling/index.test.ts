// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { useGithubPolling } from './index';

let useAppStore: StoryStore;

const ledger = aSession({ goal: 'Speed up the payout export' });
const relay = aSession({ goal: 'Stop notify-relay posting a second credit' });
const payments = aSession({ goal: 'Retry policy for 429s on payments-api' });

const sweep = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  sweep.mockClear();
  useAppStore.setState({
    sessions: [ledger, relay, payments],
    sessionBranches: { [ledger.id]: 'main', [relay.id]: 'main', [payments.id]: 'main' },
    sweepRequests: sweep,
  });
});

afterEach(cleanup);

describe('useGithubPolling', () => {
  it('sweeps everything once on mount, the current session first', () => {
    renderHook(() => useGithubPolling());

    expect(sweep).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenCalledWith({ isCurrentFirst: true });
  });

  it('refetches only the session whose branch changed', () => {
    renderHook(() => useGithubPolling());
    sweep.mockClear();

    act(() => {
      useAppStore.setState({
        sessionBranches: {
          [ledger.id]: 'main',
          [relay.id]: 'fix/credit-twice',
          [payments.id]: 'main',
        },
      });
    });

    expect(sweep).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenCalledWith({ sessionId: relay.id });
  });

  it('sweeps once for the whole board when several branches change together', () => {
    renderHook(() => useGithubPolling());
    sweep.mockClear();

    act(() => {
      useAppStore.setState({
        sessionBranches: {
          [ledger.id]: 'feature/export',
          [relay.id]: 'fix/credit-twice',
          [payments.id]: 'main',
        },
      });
    });

    expect(sweep).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenCalledWith();
  });

  it('does nothing when a branch signature stays the same', () => {
    renderHook(() => useGithubPolling());
    sweep.mockClear();

    act(() => {
      useAppStore.setState({ sessionBranches: { ...useAppStore.getState().sessionBranches } });
    });

    expect(sweep).not.toHaveBeenCalled();
  });
});
