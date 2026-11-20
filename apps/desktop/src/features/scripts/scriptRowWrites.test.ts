// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type ProjectId,
  type ProjectScriptId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../store/storyHarness';
import type { ReportErrorParams } from '../../store/slices/notifications/reportError';
import { deleteSavedScript } from './deleteSavedScript';
import { duplicateScript } from './duplicateScript';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-ledger-core' });
const SCRIPT_ID = brandId<ProjectScriptId>({ value: 'script-replay' });

let useAppStore: StoryStore;
const reportError = vi.fn(async (_params: ReportErrorParams) => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  reportError.mockClear();
  useAppStore.setState({ reportError });
});

const reportedRetry = () => {
  const retry = reportError.mock.calls[0]?.[0].retry;
  if (retry === undefined) {
    throw new Error('the failure carries no Retry');
  }
  return retry;
};

describe('the write verbs of a script row', () => {
  it('logs a failed delete once, and its Retry deletes the same script', async () => {
    const deleteScript = vi.fn(async (_id: ProjectScriptId, _workspace: WorkspaceId) => undefined);
    deleteScript.mockRejectedValueOnce(new Error('database is locked'));
    useAppStore.setState({ deleteScript });

    expect(
      await deleteSavedScript({
        workspaceId: WORKSPACE_ID,
        sessionId: SESSION_ID,
        savedId: SCRIPT_ID,
        name: 'replay-settlements',
      }),
    ).toBe(false);

    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError.mock.calls[0]?.[0]).toMatchObject({
      title: "Couldn't delete replay-settlements",
      sessionId: SESSION_ID,
    });
    expect(await reportedRetry()()).toBe(true);
    expect(deleteScript).toHaveBeenLastCalledWith(SCRIPT_ID, WORKSPACE_ID);
    expect(deleteScript).toHaveBeenCalledTimes(2);
  });

  it('logs a failed duplicate once, and its Retry saves the same copy', async () => {
    const saveScript = vi.fn();
    saveScript.mockRejectedValueOnce(new Error('disk full'));
    saveScript.mockResolvedValueOnce(undefined);
    useAppStore.setState({ saveScript });

    expect(
      await duplicateScript({
        workspaceId: WORKSPACE_ID,
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        name: 'replay-settlements',
        body: 'pnpm replay',
      }),
    ).toBe(false);

    expect(reportError.mock.calls[0]?.[0].title).toBe("Couldn't duplicate replay-settlements");
    expect(await reportedRetry()()).toBe(true);
    const copyId = saveScript.mock.calls[0]?.[0].id;
    expect(copyId).toEqual(expect.any(String));
    expect(saveScript).toHaveBeenLastCalledWith({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      id: copyId,
      name: 'replay-settlements copy',
      body: 'pnpm replay',
    });
  });

  it('keeps one copy when the save landed but its refresh failed, and the Retry writes the same id', async () => {
    const saved = new Set<string>();
    const saveScript = vi.fn(async ({ id }: { readonly id?: ProjectScriptId }) => {
      saved.add(id ?? 'no id');
      if (saveScript.mock.calls.length === 1) {
        throw new Error('the script list could not be read');
      }
    });
    useAppStore.setState({ saveScript });

    expect(
      await duplicateScript({
        workspaceId: WORKSPACE_ID,
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        name: 'replay-settlements',
        body: 'pnpm replay',
      }),
    ).toBe(false);
    expect(await reportedRetry()()).toBe(true);

    expect(saveScript).toHaveBeenCalledTimes(2);
    expect(saved.size).toBe(1);
  });
});
