// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type ProviderId,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';

const { writePool } = vi.hoisted(() => ({
  writePool: vi.fn(async (_params: unknown): Promise<void> => undefined),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({ updateWorkflowRunProviderPool: writePool }),
);

import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';

const RUN_ID = brandId<WorkflowRunId>({ value: 'run-harborline-pages' });

const RUN: WorkflowRun = {
  id: RUN_ID,
  workflowId: brandId<WorkflowId>({ value: 'workflow-orchestrated' }),
  ordinal: 0,
  currentStep: 0,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
};

const SESSION = aSession({ workflowRuns: [RUN] });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  writePool.mockReset();
  writePool.mockResolvedValue(undefined);
  useAppStore.setState({ sessions: [SESSION] });
});

const poolOf = (): ReadonlyArray<ProviderId> | undefined =>
  useAppStore.getState().sessions[0]?.workflowRuns[0]?.providerPool;

type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
};

const deferred = (): Deferred => {
  let resolve = () => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = () => {
      settle();
      return undefined;
    };
  });
  return { promise, resolve };
};

describe('setWorkflowRunProviderPool', () => {
  it('writes the pool of the run it names, then shows it', async () => {
    const outcome = await useAppStore.getState().setWorkflowRunProviderPool({
      sessionId: SESSION.id,
      workflowRunId: RUN_ID,
      pool: ['codex'],
    });

    expect(outcome).toBe('applied');
    expect(writePool).toHaveBeenCalledWith(
      expect.objectContaining({ workflowRunId: RUN_ID, pool: ['codex'] }),
    );
    expect(poolOf()).toEqual(['codex']);
  });

  it('keeps the old pool and throws when the write fails', async () => {
    writePool.mockRejectedValueOnce(new Error('database is locked'));

    await expect(
      useAppStore.getState().setWorkflowRunProviderPool({
        sessionId: SESSION.id,
        workflowRunId: RUN_ID,
        pool: ['codex'],
      }),
    ).rejects.toThrow('database is locked');
    expect(poolOf()).toBeUndefined();
  });

  it('drops a late answer for an older pool', async () => {
    const first = deferred();
    writePool.mockImplementationOnce(() => first.promise);
    const { setWorkflowRunProviderPool } = useAppStore.getState();

    const older = setWorkflowRunProviderPool({
      sessionId: SESSION.id,
      workflowRunId: RUN_ID,
      pool: ['codex'],
    });
    const newer = await setWorkflowRunProviderPool({
      sessionId: SESSION.id,
      workflowRunId: RUN_ID,
      pool: ['anthropic'],
    });
    first.resolve();

    expect(newer).toBe('applied');
    expect(await older).toBe('stale');
    expect(poolOf()).toEqual(['anthropic']);
  });

  it('clears the pool back to the workspace one', async () => {
    useAppStore.setState({
      sessions: [{ ...SESSION, workflowRuns: [{ ...RUN, providerPool: ['codex'] }] }],
    });

    await useAppStore.getState().setWorkflowRunProviderPool({
      sessionId: SESSION.id,
      workflowRunId: RUN_ID,
      pool: null,
    });

    expect(poolOf()).toBeUndefined();
  });
});
