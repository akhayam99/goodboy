import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionEventPayload, SessionProjectMount } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  A_REBASE_MOUNT_ID,
  A_REBASE_SESSION_ID,
} from '../../../features/history/testing/aRebaseRun';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../storyHarness';
import { historyTargetOf } from './historyTargetOf';
import { recordHistoryEvent } from './recordHistoryEvent';
import { setHistoryRun } from './setHistoryRun';
import type { HistoryRunOrigin } from './types';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);

const project = aProject({ name: 'ledger-core', baseBranch: 'main' });
const mount: SessionProjectMount = {
  mountId: A_REBASE_MOUNT_ID,
  sessionId: A_REBASE_SESSION_ID,
  projectId: project.id,
  mountName: 'ledger-core',
  worktreePath: '/w/ledger-core',
  lastWorktreePath: null,
  repoRoot: '/repos/ledger-core',
  branch: 'hl/ledger',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

let store: Awaited<ReturnType<typeof importStore>>;
const recorded: Array<SessionEventPayload | null | undefined> = [];

type RunParams = {
  readonly origin: HistoryRunOrigin;
  readonly batchId: string | null;
};

const withRun = ({ origin, batchId }: RunParams): void => {
  setHistoryRun({
    set: store.setState,
    sessionId: A_REBASE_SESSION_ID,
    mountId: A_REBASE_MOUNT_ID,
    origin,
    patch: { batchId },
  });
};

type RecordParams = {
  readonly origin: HistoryRunOrigin;
};

const recordedBatchOf = async ({ origin }: RecordParams): Promise<string | undefined> => {
  recorded.length = 0;
  await recordHistoryEvent({
    get: store.getState,
    kind: 'history_rewritten',
    target: historyTargetOf({
      get: store.getState,
      sessionId: A_REBASE_SESSION_ID,
      mountId: A_REBASE_MOUNT_ID,
    }),
    origin,
    planId: null,
  });
  return recorded[0]?.batchId;
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  recorded.length = 0;
  store.setState({
    sessions: [aSession({ id: A_REBASE_SESSION_ID })],
    projects: [project],
    sessionProjectMounts: { [A_REBASE_SESSION_ID]: [mount] },
    recordSessionEvent: vi.fn(async ({ payload }) => {
      recorded.push(payload);
      return undefined;
    }),
  });
});

describe('recordHistoryEvent batch key', () => {
  it('writes the batch of the rebase run into the payload', async () => {
    withRun({ origin: 'rebase', batchId: 'batch-9' });

    await expect(recordedBatchOf({ origin: 'rebase' })).resolves.toBe('batch-9');
  });

  it('writes no batch for a rebase that is not part of a rebase all', async () => {
    withRun({ origin: 'rebase', batchId: null });

    await expect(recordedBatchOf({ origin: 'rebase' })).resolves.toBeUndefined();
  });

  it('never carries an old batch into a plan rewrite on the same branch', async () => {
    withRun({ origin: 'plan', batchId: 'batch-9' });

    await expect(recordedBatchOf({ origin: 'plan' })).resolves.toBeUndefined();
  });
});
