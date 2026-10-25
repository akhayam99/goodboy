// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type Agent, type AgentId, type SessionId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';

let store: StoryStore;
let useAutoTrees: typeof import('./index').useAutoTrees;

const TWO_SECONDS_MS = 2000;
const SESSION_ID = brandId<SessionId>({ value: 'session-payments' });
const loadAutoTrees = vi.fn(async (_params: { readonly sessionId: SessionId }) => undefined);

beforeAll(async () => {
  store = await importStore();
  ({ useAutoTrees } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.useFakeTimers();
  await resetStoryStore();
  loadAutoTrees.mockClear();
  store.setState({ loadAutoTrees });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type AgentParams = {
  readonly status: Agent['status'];
};

const autoAgent = ({ status }: AgentParams): Agent =>
  anAgent({
    id: brandId<AgentId>({ value: 'agent-auto-root' }),
    sessionId: SESSION_ID,
    kind: 'auto',
    name: 'Check the payout docs',
    status,
  });

const seedAgents = ({ agents }: { readonly agents: ReadonlyArray<Agent> }): void => {
  store.setState({ sessionPhaseRuns: { [SESSION_ID]: agents } });
};

const tick = (count: number): void => {
  act(() => {
    vi.advanceTimersByTime(TWO_SECONDS_MS * count);
  });
};

describe('useAutoTrees polling', () => {
  it('reads once on mount and then stays quiet for a session with no Auto agent', () => {
    renderHook(() => useAutoTrees({ sessionId: SESSION_ID }));

    tick(5);

    expect(loadAutoTrees).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a session whose Auto agent finished', () => {
    seedAgents({ agents: [autoAgent({ status: 'completed' })] });
    renderHook(() => useAutoTrees({ sessionId: SESSION_ID }));

    tick(5);

    expect(loadAutoTrees).toHaveBeenCalledTimes(1);
  });

  it('polls every two seconds while an Auto agent runs', () => {
    seedAgents({ agents: [autoAgent({ status: 'running' })] });
    renderHook(() => useAutoTrees({ sessionId: SESSION_ID }));
    loadAutoTrees.mockClear();

    tick(3);

    expect(loadAutoTrees).toHaveBeenCalledTimes(3);
  });

  it('stops polling when the Auto agent finishes', () => {
    seedAgents({ agents: [autoAgent({ status: 'running' })] });
    renderHook(() => useAutoTrees({ sessionId: SESSION_ID }));
    tick(1);

    act(() => {
      seedAgents({ agents: [autoAgent({ status: 'completed' })] });
    });
    loadAutoTrees.mockClear();
    tick(5);

    expect(loadAutoTrees).not.toHaveBeenCalled();
  });

  it('shares one interval between two hooks on the same session', () => {
    seedAgents({ agents: [autoAgent({ status: 'running' })] });
    renderHook(() => useAutoTrees({ sessionId: SESSION_ID }));
    renderHook(() => useAutoTrees({ sessionId: SESSION_ID }));
    loadAutoTrees.mockClear();

    tick(3);

    expect(loadAutoTrees).toHaveBeenCalledTimes(3);
  });

  it('keeps polling for the second hook when the first one unmounts', () => {
    seedAgents({ agents: [autoAgent({ status: 'running' })] });
    const first = renderHook(() => useAutoTrees({ sessionId: SESSION_ID }));
    renderHook(() => useAutoTrees({ sessionId: SESSION_ID }));
    first.unmount();
    loadAutoTrees.mockClear();

    tick(2);

    expect(loadAutoTrees).toHaveBeenCalledTimes(2);
  });

  it('clears the interval when the last hook unmounts', () => {
    seedAgents({ agents: [autoAgent({ status: 'running' })] });
    const only = renderHook(() => useAutoTrees({ sessionId: SESSION_ID }));
    only.unmount();
    loadAutoTrees.mockClear();

    tick(5);

    expect(loadAutoTrees).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
