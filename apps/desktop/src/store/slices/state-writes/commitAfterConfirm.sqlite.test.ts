import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';
import { ReportedError } from '../notifications/reportedError';
import { commitAfterConfirm } from './commitAfterConfirm';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  useAppStore.setState({ currentWorkspaceId: WORKSPACE_ID });
});

const storedErrors = async () =>
  rowsOf<{ title: string; body: string | null; workspace_id: string | null }>({
    sql: "SELECT title, body, workspace_id FROM notifications WHERE kind = 'error'",
  });

const run = <Value>({
  step,
  commit,
}: {
  readonly step: () => Promise<Value>;
  readonly commit: (value: Value) => void;
}) =>
  commitAfterConfirm({
    get: useAppStore.getState,
    failureTitle: 'Could not save the pin',
    target: { workspaceId: WORKSPACE_ID },
    step,
    commit,
  });

describe('commitAfterConfirm applies state only after the step succeeded', () => {
  it('commits the value once the step resolved', async () => {
    const committed: string[] = [];

    const result = await run({ step: async () => 'pinned', commit: (v) => committed.push(v) });

    expect(result).toEqual({ isOk: true, value: 'pinned' });
    expect(committed).toEqual(['pinned']);
    expect(await storedErrors()).toEqual([]);
  });

  it('does not commit while the step is pending', async () => {
    const committed: string[] = [];
    let release: (value: string) => void = () => undefined;
    const pending = run({
      step: () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
      commit: (v) => committed.push(v),
    });

    await Promise.resolve();
    expect(committed).toEqual([]);
    release('done');
    await pending;
    expect(committed).toEqual(['done']);
  });

  it('leaves state unchanged on failure and reports it on the target workspace', async () => {
    const committed: string[] = [];

    const result = await run({
      step: async () => {
        throw new Error('the write was rejected');
      },
      commit: (v: string) => committed.push(v),
    });

    expect(result.isOk).toBe(false);
    expect(committed).toEqual([]);
    const errors = await storedErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      title: 'Could not save the pin',
      body: 'the write was rejected',
      workspace_id: WORKSPACE_ID,
    });
    expect(useAppStore.getState().notifications.map((n) => n.title)).toContain(
      'Could not save the pin',
    );
  });

  it('returns the original error to the caller', async () => {
    const failure = new Error('offline');

    const result = await run({
      step: async () => {
        throw failure;
      },
      commit: () => undefined,
    });

    expect(result).toEqual({ isOk: false, error: failure });
  });

  it('does not report an error that was already shown', async () => {
    const result = await run({
      step: async () => {
        throw new ReportedError('already on screen');
      },
      commit: () => undefined,
    });

    expect(result.isOk).toBe(false);
    expect(await storedErrors()).toEqual([]);
  });
});
