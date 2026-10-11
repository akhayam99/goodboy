vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderRunId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';
import { probeLock } from './probeLock';

let store: StoryStore;
beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  vi.useRealTimers();
});

const deferred = () => {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

type LiveParams = { readonly shouldRun: boolean };
const seedLive = ({ shouldRun }: LiveParams) => {
  const [runId] = ['harborline-run'].filter((id): id is ProviderRunId =>
    id.startsWith('harborline-'),
  );
  if (runId === undefined) {
    throw new Error('Missing run id');
  }
  const session = aSession();
  const agent = anAgent({ sessionId: session.id, providerOverride: 'cursor' });
  store.setState({
    sessionPhaseRuns: { [session.id]: [agent] },
    agentTurnState: {
      [agent.id]: shouldRun
        ? { kind: 'running', runId, startedAt: session.createdAt }
        : { kind: 'idle', lastActivityAt: session.createdAt },
    },
    runRouting: {
      [agent.id]: {
        [runId]: { provider: 'cursor', model: 'harborline-model', effort: null },
      },
    },
  });
};

describe('provider probe lock', () => {
  it('shares the same promise for two status calls', async () => {
    const wait = deferred();
    const run = vi.fn(() => wait.promise);
    const first = probeLock({
      get: store.getState,
      providerId: 'cursor',
      kind: 'status',
      isAutomatic: false,
      run,
    });
    const second = probeLock({
      get: store.getState,
      providerId: 'cursor',
      kind: 'status',
      isAutomatic: false,
      run,
    });
    expect(second).toBe(first);
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    wait.release();
    await first;
  });

  it('queues usage after status and lets another provider proceed', async () => {
    const wait = deferred();
    const status = probeLock({
      get: store.getState,
      providerId: 'cursor',
      kind: 'status',
      isAutomatic: false,
      run: () => wait.promise,
    });
    const usageRun = vi.fn(async () => undefined);
    const usage = probeLock({
      get: store.getState,
      providerId: 'cursor',
      kind: 'usage',
      isAutomatic: false,
      run: usageRun,
    });
    await probeLock({
      get: store.getState,
      providerId: 'anthropic',
      kind: 'usage',
      isAutomatic: false,
      run: async () => undefined,
    });
    expect(usageRun).not.toHaveBeenCalled();
    wait.release();
    await Promise.all([status, usage]);
    expect(usageRun).toHaveBeenCalledOnce();
  });

  it.each(['test', 'status'] as const)(
    'skips automatic probes during a Cursor turn and waits for manual %s',
    async (kind) => {
      vi.useFakeTimers();
      seedLive({ shouldRun: true });
      const run = vi.fn(async () => undefined);
      await probeLock({
        get: store.getState,
        providerId: 'cursor',
        kind: 'status',
        isAutomatic: true,
        run,
      });
      const test = probeLock({
        get: store.getState,
        providerId: 'cursor',
        kind,
        isAutomatic: false,
        run,
      });
      await vi.advanceTimersByTimeAsync(200);
      expect(run).not.toHaveBeenCalled();
      seedLive({ shouldRun: false });
      await vi.advanceTimersByTimeAsync(100);
      await test;
      expect(run).toHaveBeenCalledOnce();
    },
  );

  it('releases the queue after a failure so a retry can run', async () => {
    await expect(
      probeLock({
        get: store.getState,
        providerId: 'cursor',
        kind: 'status',
        isAutomatic: false,
        run: async () => {
          throw new Error('offline');
        },
      }),
    ).rejects.toThrow('offline');
    const run = vi.fn(async () => undefined);
    await probeLock({
      get: store.getState,
      providerId: 'cursor',
      kind: 'status',
      isAutomatic: false,
      run,
    });
    expect(run).toHaveBeenCalledOnce();
  });
});
