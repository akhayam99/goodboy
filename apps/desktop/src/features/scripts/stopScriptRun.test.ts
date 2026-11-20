// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { stopScriptRun } from './stopScriptRun';

let useAppStore: StoryStore;

const HARBORLINE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const SESSION = aSession({ workspaceId: HARBORLINE.id, goal: 'Round the ledger' });

const seedRunning = () => {
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    sessions: [SESSION],
    scriptRuns: {
      [SESSION.id]: { dev: { status: 'pending', result: null, runId: 'run-dev', startedAt: 1 } },
    },
  });
};

const statusOf = () => useAppStore.getState().scriptRuns[SESSION.id]?.dev?.status;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('stopping a running script', () => {
  it('marks the run stopped once the stop goes through', async () => {
    stubStoryInvoke({ workspace_script_cancel: null });
    seedRunning();

    expect(await stopScriptRun({ sessionId: SESSION.id, scriptKey: 'dev' })).toBe(true);

    expect(statusOf()).toBe('cancelled');
  });

  it('keeps the run going and says so when the stop fails', async () => {
    stubStoryInvoke({
      workspace_script_cancel: () => {
        throw new Error('process table locked');
      },
      db_execute: { rowsAffected: 1, lastInsertId: 0 },
      db_select: [],
    });
    seedRunning();

    expect(await stopScriptRun({ sessionId: SESSION.id, scriptKey: 'dev' })).toBe(false);

    expect(statusOf()).toBe('pending');
    await vi.waitFor(() =>
      expect(useAppStore.getState().notifications.map((notice) => notice.title)).toContain(
        "Couldn't stop the script",
      ),
    );
  });
});
