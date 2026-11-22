// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkEvent } from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';

const listWorkEvents = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({ listWorkEvents }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger-core' });
const LIMIT = 200;

let useAppStore: StoryStore;

type ScriptRunParams = {
  readonly id: string;
};

const scriptRun = ({ id }: ScriptRunParams): WorkEvent => ({
  id,
  runId: `run-${id}`,
  sessionId: SESSION_ID,
  mountId: null,
  agentId: null,
  kind: 'script',
  startedAt: 1_000,
  endedAt: 2_000,
  exitCode: 0,
  payload: { name: 'test' },
});

type Deferred = {
  readonly promise: Promise<ReadonlyArray<WorkEvent>>;
  readonly resolve: (events: ReadonlyArray<WorkEvent>) => void;
};

const deferred = (): Deferred => {
  let resolve: Deferred['resolve'] = () => undefined;
  const promise = new Promise<ReadonlyArray<WorkEvent>>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
};

const idsNow = (): ReadonlyArray<string> | undefined =>
  useAppStore.getState().workEvents[SESSION_ID]?.map((event) => event.id);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  listWorkEvents.mockReset();
});

describe('loadWorkEvents', () => {
  it('keeps only the latest answer when two reads cross', async () => {
    const first = deferred();
    const second = deferred();
    listWorkEvents.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { loadWorkEvents } = useAppStore.getState();

    const older = loadWorkEvents({ sessionId: SESSION_ID, limit: LIMIT });
    const newer = loadWorkEvents({ sessionId: SESSION_ID, limit: LIMIT });
    second.resolve([scriptRun({ id: 'new' })]);
    await newer;
    first.resolve([scriptRun({ id: 'old' })]);
    await older;

    expect(idsNow()).toEqual(['new']);
  });

  it('keeps the rows it had and records the error when a read fails', async () => {
    listWorkEvents
      .mockResolvedValueOnce([scriptRun({ id: 'kept' })])
      .mockRejectedValueOnce(new Error('database is locked'));
    const { loadWorkEvents } = useAppStore.getState();

    await loadWorkEvents({ sessionId: SESSION_ID, limit: LIMIT });
    await loadWorkEvents({ sessionId: SESSION_ID, limit: LIMIT });

    expect(idsNow()).toEqual(['kept']);
    expect(useAppStore.getState().workEventsError[SESSION_ID]).toBe('database is locked');
  });
});
