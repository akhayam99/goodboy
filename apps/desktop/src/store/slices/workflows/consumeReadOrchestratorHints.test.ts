import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { brandId, type IsoDateTime, type OrchestratorHint } from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());

vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);

const RUN = aWorkflowRun();
const QUEUED: OrchestratorHint = {
  id: 'hint-queued',
  text: 'run a reviewer before the PR',
  createdAt: brandId<IsoDateTime>({ value: '2026-09-23T10:00:00.000Z' }),
};
const SESSION = aSession({ workflowRuns: [{ ...RUN, orchestratorHints: [QUEUED] }] });

let store: StoryStore;
let updateHintsSpy: Mock;
let consumeReadOrchestratorHints: typeof import('./updateOrchestratorHints').consumeReadOrchestratorHints;

beforeAll(async () => {
  store = await importStore();
  ({ consumeReadOrchestratorHints } = await import('./updateOrchestratorHints'));
  updateHintsSpy = vi.mocked((await import('@goodboy/db')).updateWorkflowRunOrchestratorHints);
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  resetStorySpies();
  updateHintsSpy.mockReset();
  updateHintsSpy.mockResolvedValue(undefined);
  store.setState({ sessions: [SESSION], reportError: vi.fn(async () => undefined) });
});

const consume = (): Promise<void> =>
  consumeReadOrchestratorHints({
    set: store.setState,
    get: store.getState,
    sessionId: SESSION.id,
    workflowRunId: RUN.id,
    readIds: new Set([QUEUED.id]),
    step: 2,
    consumedAt: brandId<IsoDateTime>({ value: '2026-09-23T11:00:00.000Z' }),
  });

describe('consumeReadOrchestratorHints', () => {
  it('marks the read hints consumed', async () => {
    await consume();

    expect(updateHintsSpy).toHaveBeenCalledOnce();
    expect(store.getState().reportError).not.toHaveBeenCalled();
  });

  it('reports a failed write and leaves the hints unread instead of throwing', async () => {
    updateHintsSpy.mockRejectedValueOnce(new Error('database is locked'));

    await expect(consume()).resolves.toBeUndefined();

    expect(store.getState().reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't mark the hints as read",
        sessionId: SESSION.id,
      }),
    );
    const run = store.getState().sessions[0]?.workflowRuns[0];
    expect(run?.orchestratorHints?.[0]?.consumedAt).toBeUndefined();
  });
});
