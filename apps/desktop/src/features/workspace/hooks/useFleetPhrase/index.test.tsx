// @vitest-environment happy-dom
type WorkEvent = {
  readonly payload: unknown;
};

type WorkHandler = (event: WorkEvent) => void;

type WorkEvents = {
  handler: WorkHandler | null;
};

const { events } = vi.hoisted(() => {
  const value: WorkEvents = { handler: null };
  return { events: value };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (name: string, handler: WorkHandler) => {
    if (name === 'work-changed') {
      events.handler = handler;
    }
    return () => {
      events.handler = null;
    };
  }),
}));

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { mountFixture } from '../../../../__tests__/helpers/actionFixtures';
import { FLEET_EVERY_MS, FLEET_MIN_MS, useFleetPhrase } from '.';

const SESSION = brandId<SessionId>({ value: 'session-fleet-export' });
const OTHER = brandId<SessionId>({ value: 'session-fleet-retry' });
const MOUNT = brandId<MountId>({ value: 'mount-fleet-ledger-core' });

type RowParams = {
  readonly sessionId: string;
  readonly command: string;
  readonly mountId?: string | null;
  readonly runId?: string;
  readonly startedAt?: number;
};

const rowOf = ({
  sessionId,
  command,
  mountId = null,
  runId = 'run-1',
  startedAt = 1,
}: RowParams) => ({
  runId,
  sessionId,
  agentId: `agent-${runId}`,
  mountId,
  workflowRunId: null,
  branch: null,
  startedAt,
  quietMs: 0,
  tool: { name: 'Bash', command, path: null },
  hasToolCall: true,
  canSeeTools: true,
});

type AdvanceParams = {
  readonly ms: number;
};

type ChangeParams = {
  readonly sessionId: string;
};

type Answer = () => Promise<unknown>;

const live: { answer: Answer } = { answer: async () => [] };

const liveReads = (): number =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'live_work').length;

const advance = async ({ ms }: AdvanceParams) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const emitChange = async ({ sessionId }: ChangeParams) => {
  await act(async () => {
    events.handler?.({ payload: { sessionId, mountId: null } });
    await vi.advanceTimersByTimeAsync(0);
  });
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.useFakeTimers();
  await resetStoryStore();
  Object.assign(window, { __TAURI_INTERNALS__: {} });
  events.handler = null;
  live.answer = async () => [];
  storySpies.tauriInvoke.mockImplementation(async (command) =>
    command === 'live_work' ? live.answer() : null,
  );
  store.setState({
    sessionProjectMounts: {
      [SESSION]: [mountFixture({ mountId: MOUNT, sessionId: SESSION, mountName: 'ledger-core' })],
      [OTHER]: [
        mountFixture({
          mountId: brandId<MountId>({ value: 'mount-a' }),
          sessionId: OTHER,
          mountName: 'payments-api',
        }),
        mountFixture({
          mountId: brandId<MountId>({ value: 'mount-b' }),
          sessionId: OTHER,
          mountName: 'notify-relay',
        }),
      ],
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  vi.useRealTimers();
});

describe('useFleetPhrase', () => {
  it('reads every session once and names the project of a mounted agent', async () => {
    live.answer = async () => [
      rowOf({ sessionId: SESSION, command: 'pnpm test retry', mountId: MOUNT }),
      rowOf({ sessionId: OTHER, command: 'pnpm lint', runId: 'run-2' }),
    ];
    const first = renderHook(() => useFleetPhrase({ sessionId: SESSION }));
    const second = renderHook(() => useFleetPhrase({ sessionId: OTHER }));
    await advance({ ms: 0 });

    expect(first.result.current).toBe('Running pnpm test retry in ledger-core');
    expect(liveReads()).toBe(1);
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('live_work', { sessionId: null });
    first.unmount();
    second.unmount();
  });

  it('never names a project for an agent without a mount', async () => {
    live.answer = async () => [rowOf({ sessionId: OTHER, command: 'pnpm lint' })];
    const { result, unmount } = renderHook(() => useFleetPhrase({ sessionId: OTHER }));
    await advance({ ms: 0 });

    expect(result.current).toBe('Running pnpm lint');
    expect(result.current).not.toMatch(/payments-api|notify-relay/);
    unmount();
  });

  it('says the newest run when a session has two', async () => {
    live.answer = async () => [
      rowOf({ sessionId: SESSION, command: 'pnpm test', runId: 'run-old', startedAt: 1 }),
      rowOf({ sessionId: SESSION, command: 'pnpm build', runId: 'run-new', startedAt: 9 }),
    ];
    const { result, unmount } = renderHook(() => useFleetPhrase({ sessionId: SESSION }));
    await advance({ ms: 0 });

    expect(result.current).toBe('Running pnpm build');
    unmount();
  });

  it('changes the phrase no sooner than five seconds after the last read', async () => {
    live.answer = async () => [rowOf({ sessionId: SESSION, command: 'pnpm test' })];
    const { result, unmount } = renderHook(() => useFleetPhrase({ sessionId: SESSION }));
    await advance({ ms: 0 });
    live.answer = async () => [rowOf({ sessionId: SESSION, command: 'pnpm lint' })];

    await emitChange({ sessionId: SESSION });
    await emitChange({ sessionId: SESSION });
    await advance({ ms: FLEET_MIN_MS - 1 });
    expect(result.current).toBe('Running pnpm test');
    expect(liveReads()).toBe(1);

    await advance({ ms: 1 });
    expect(result.current).toBe('Running pnpm lint');
    expect(liveReads()).toBe(2);
    unmount();
  });

  it('picks up a change within fifteen seconds with no event', async () => {
    live.answer = async () => [rowOf({ sessionId: SESSION, command: 'pnpm test' })];
    const { result, unmount } = renderHook(() => useFleetPhrase({ sessionId: SESSION }));
    await advance({ ms: 0 });
    live.answer = async () => [rowOf({ sessionId: SESSION, command: 'pnpm lint' })];

    await advance({ ms: FLEET_EVERY_MS - 1 });
    expect(result.current).toBe('Running pnpm test');
    await advance({ ms: 1 });
    expect(result.current).toBe('Running pnpm lint');
    unmount();
  });

  it('keeps the last phrase when a read fails', async () => {
    live.answer = async () => [rowOf({ sessionId: SESSION, command: 'pnpm test' })];
    const { result, unmount } = renderHook(() => useFleetPhrase({ sessionId: SESSION }));
    await advance({ ms: 0 });
    live.answer = async () => {
      throw new Error('live work unavailable');
    };

    await advance({ ms: FLEET_EVERY_MS });
    expect(result.current).toBe('Running pnpm test');
    unmount();
  });

  it('drops a late answer for an older read', async () => {
    const pending: Array<(rows: ReadonlyArray<unknown>) => void> = [];
    live.answer = () =>
      new Promise((resolve) => {
        pending.push(resolve);
      });
    const { result, unmount } = renderHook(() => useFleetPhrase({ sessionId: SESSION }));
    await advance({ ms: 0 });
    await advance({ ms: FLEET_EVERY_MS });

    await act(async () => {
      pending[1]?.([rowOf({ sessionId: SESSION, command: 'pnpm lint' })]);
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      pending[0]?.([rowOf({ sessionId: SESSION, command: 'pnpm test' })]);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toBe('Running pnpm lint');
    unmount();
  });

  it('says nothing once the run ends and stops reading after the last reader leaves', async () => {
    live.answer = async () => [rowOf({ sessionId: SESSION, command: 'pnpm test' })];
    const { result, unmount } = renderHook(() => useFleetPhrase({ sessionId: SESSION }));
    await advance({ ms: 0 });
    live.answer = async () => [];

    await advance({ ms: FLEET_EVERY_MS });
    expect(result.current).toBeNull();
    unmount();
    const reads = liveReads();
    await advance({ ms: FLEET_EVERY_MS * 2 });
    expect(liveReads()).toBe(reads);
    expect(events.handler).toBeNull();
  });
});
