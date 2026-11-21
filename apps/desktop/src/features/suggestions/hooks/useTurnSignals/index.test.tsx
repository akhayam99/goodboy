// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useTurnSignals } from '.';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const AGENT = brandId<AgentId>({ value: 'agent-implementer' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
  storySpies.tauriInvoke.mockImplementation(async (command?: unknown) =>
    command === 'turn_quiet' ? [{ runId: RUN, quietMs: 6 * 60_000 }] : undefined,
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTurnSignals', () => {
  it('reads the turn files and the quiet time only after the page had its first moment', async () => {
    const refreshTurnFiles = vi.fn(async () => true);
    useAppStore.setState({
      refreshTurnFiles,
      agentTurnState: {
        [AGENT]: {
          kind: 'running',
          runId: RUN,
          startedAt: brandId<IsoDateTime>({ value: '2026-11-21T09:00:00.000Z' }),
        },
      },
      agentRunHistory: { [AGENT]: [RUN] },
    });
    const { result } = renderHook(() =>
      useTurnSignals({ sessionId: SESSION, agents: [anAgent({ id: AGENT, sessionId: SESSION })] }),
    );
    expect(refreshTurnFiles).not.toHaveBeenCalled();
    expect(result.current.quietByAgent).toEqual({});

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });
    expect(refreshTurnFiles).toHaveBeenCalledWith({ sessionId: SESSION });
    expect(result.current.quietByAgent).toEqual({ [AGENT]: 6 * 60_000 });
  });

  it('asks for the quiet time of no agent while none runs', async () => {
    renderHook(() =>
      useTurnSignals({ sessionId: SESSION, agents: [anAgent({ id: AGENT, sessionId: SESSION })] }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(
      storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'turn_quiet'),
    ).toEqual([]);
  });

  it('keeps the latest turn per mount as the time a mount was touched', () => {
    useAppStore.setState({
      turnFiles: {
        [SESSION]: [
          { mountId: brandId({ value: 'mount-a' }), paths: ['a.ts'], recordedAtMs: 100 },
          { mountId: brandId({ value: 'mount-a' }), paths: ['b.ts'], recordedAtMs: 300 },
          { mountId: brandId({ value: 'mount-a' }), paths: [], recordedAtMs: 900 },
        ],
      },
    });
    const { result } = renderHook(() => useTurnSignals({ sessionId: SESSION, agents: [] }));
    expect(result.current.touches).toEqual({ 'mount-a': 300 });
  });
});
