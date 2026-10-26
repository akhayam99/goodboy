// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type AgentId, type ProviderRunId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { stopRequests } from '../../../store/slices/turn/stopRequests';
import { useAgentStop } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'sess' });
const AGENT_ID = brandId<AgentId>({ value: 'agent' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-1' });
const OTHER_RUN_ID = brandId<ProviderRunId>({ value: 'run-2' });

const cancelMock = vi.fn(async () => undefined);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
  cancelMock.mockReset().mockResolvedValue(undefined);
  useAppStore.setState({
    agentTurnState: { [AGENT_ID]: { kind: 'running', runId: RUN_ID, startedAt: STORY_NOW } },
    cancelCurrentTurn: cancelMock,
  });
});

afterEach(() => {
  stopRequests.settle({ agentId: AGENT_ID });
  cleanup();
  vi.useRealTimers();
});

const hook = () => renderHook(() => useAgentStop({ sessionId: SESSION_ID, agentId: AGENT_ID }));

describe('useAgentStop', () => {
  it('reads idle while nothing asked to stop, and live while the turn runs', () => {
    const { result } = hook();

    expect(result.current).toMatchObject({ phase: 'idle', isLive: true });
  });

  it('stops the turn of the named agent as the user', () => {
    const { result } = hook();

    act(() => result.current.stop());

    expect(cancelMock).toHaveBeenCalledWith(SESSION_ID, AGENT_ID, 'user');
  });

  it('reads stopping at once, then stalled after 5 seconds without an exit', () => {
    const { result } = hook();

    act(() => stopRequests.request({ agentId: AGENT_ID, runId: RUN_ID, at: Date.now() }));
    expect(result.current.phase).toBe('stopping');

    act(() => {
      vi.advanceTimersByTime(4_900);
    });
    expect(result.current.phase).toBe('stopping');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.phase).toBe('stalled');
  });

  it('goes back to idle when the stop settles', () => {
    const { result } = hook();

    act(() => stopRequests.request({ agentId: AGENT_ID, runId: RUN_ID, at: Date.now() }));
    act(() => stopRequests.settle({ agentId: AGENT_ID }));

    expect(result.current.phase).toBe('idle');
  });

  it('starts the count again when a force stop asks a second time', () => {
    const { result } = hook();
    act(() => stopRequests.request({ agentId: AGENT_ID, runId: RUN_ID, at: Date.now() }));
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(result.current.phase).toBe('stalled');

    act(() => stopRequests.request({ agentId: AGENT_ID, runId: RUN_ID, at: Date.now() }));

    expect(result.current.phase).toBe('stopping');
  });

  it('ignores a stop request that belongs to an earlier run', () => {
    const { result } = hook();

    act(() => stopRequests.request({ agentId: AGENT_ID, runId: OTHER_RUN_ID, at: Date.now() }));

    expect(result.current.phase).toBe('idle');
  });

  it('is idle and not live once the turn ended', () => {
    const { result } = hook();
    act(() => stopRequests.request({ agentId: AGENT_ID, runId: RUN_ID, at: Date.now() }));

    act(() => {
      useAppStore.setState({
        agentTurnState: { [AGENT_ID]: { kind: 'idle', lastActivityAt: STORY_NOW } },
      });
    });

    expect(result.current).toMatchObject({ phase: 'idle', isLive: false });
  });
});
