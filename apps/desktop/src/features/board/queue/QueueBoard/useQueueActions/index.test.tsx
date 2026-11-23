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

import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { sessionOf } from '../../../../workspace/testing/sessionColumn';
import type { QueueMove } from '../../needsYouOf';
import { useQueueSends } from '../useQueueSends';
import { useQueueActions } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const failing = sessionOf({ goal: 'Fix webhook retries' });
const sessionId = brandId<SessionId>({ value: failing.id });
const agentId = brandId<AgentId>({ value: 'implementer-payments-api' });
const move: QueueMove = {
  id: `${sessionId}:ci-failed`,
  sessionId,
  reason: 'ci-failed',
  title: 'Checks failing',
  since: null,
};

type Props = {
  readonly children: ReactNode;
};

const wrapper = ({ children }: Props) => <ToastProvider>{children}</ToastProvider>;

beforeEach(async () => {
  await resetStoryStore();
  useQueueSends.setState({ pending: {}, notNow: new Set(), drafts: {} });
});

afterEach(() => {
  useQueueSends.getState().flushAll();
  cleanup();
});

const undoLast = async (): Promise<boolean> => {
  let isUndone = false;
  await act(async () => {
    isUndone = await useAppStore.getState().undoLastOperation();
  });
  return isUndone;
};

describe('useQueueActions, a gesture the agent has not read yet has Undo', () => {
  it('undo of a message to an agent keeps it out of the agent queue', async () => {
    const enqueue = vi.fn(async () => true);
    useAppStore.setState({ enqueueAgentMessage: enqueue });
    const { result } = renderHook(() => useQueueActions(), { wrapper });
    act(() => result.current.message({ sessionId, agentId, text: 'Use the ledger-core fixture' }));
    expect(Object.values(useQueueSends.getState().pending)).toEqual([
      expect.objectContaining({ agentId }),
    ]);
    expect(await undoLast()).toBe(true);
    await act(async () => useQueueSends.getState().flushAll());
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('sends what waits when the window closes after the Queue is gone', async () => {
    const enqueue = vi.fn(async () => true);
    useAppStore.setState({ enqueueAgentMessage: enqueue });
    const { result, unmount } = renderHook(() => useQueueActions(), { wrapper });
    act(() => result.current.message({ sessionId, agentId, text: 'Use the ledger-core fixture' }));
    unmount();
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await vi.waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
  });

  it('undo of a message gives the text back, never over a newer draft', async () => {
    useAppStore.setState({ enqueueAgentMessage: vi.fn(async () => true) });
    const { result } = renderHook(() => useQueueActions(), { wrapper });
    act(() => result.current.message({ sessionId, agentId, text: 'Use the ledger-core fixture' }));
    expect(await undoLast()).toBe(true);
    expect(useQueueSends.getState().drafts[agentId]).toBe('Use the ledger-core fixture');

    useQueueSends.getState().setDraft({ agentId, text: '' });
    act(() => result.current.message({ sessionId, agentId, text: 'Run notify-relay first' }));
    useQueueSends.getState().setDraft({ agentId, text: 'A newer thought' });
    expect(await undoLast()).toBe(true);
    expect(useQueueSends.getState().drafts[agentId]).toBe('A newer thought');
  });

  it('undo of Not now brings the Move back once', async () => {
    const { result } = renderHook(() => useQueueActions(), { wrapper });
    act(() => result.current.notNow({ move }));
    expect(useQueueSends.getState().notNow.has(move.id)).toBe(true);
    expect(await undoLast()).toBe(true);
    expect(useQueueSends.getState().notNow.has(move.id)).toBe(false);
    expect(await undoLast()).toBe(false);
  });
});
