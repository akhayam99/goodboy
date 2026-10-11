// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSetting, setSetting } from '@goodboy/db';
import { EMPTY_OVERRIDES, aProject, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';
import { parseSavedProjectModels } from './parseSavedProjectModels';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const PAYMENTS = aProject({ workspaceId: WORKSPACE.id, name: 'payments-api' });
const LEDGER = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });

const SAVED = {
  taskModels: { summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' } },
  roleModels: { planner: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' } },
};

const keyOf = ({ projectId }: { readonly projectId: string }) =>
  `legacy.projectModels.${projectId}`;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    workspaceOverrides: { [WORKSPACE.id]: { ...EMPTY_OVERRIDES } },
  });
  await setSetting(storySqlite(), keyOf({ projectId: PAYMENTS.id }), JSON.stringify(SAVED));
  await setSetting(storySqlite(), keyOf({ projectId: LEDGER.id }), JSON.stringify(SAVED));
});

describe('the saved project models slice', () => {
  it('reads every saved key into the store, keyed by project', async () => {
    await useAppStore.getState().loadSavedProjectModels();

    expect(Object.keys(useAppStore.getState().savedProjectModels).sort()).toEqual(
      [PAYMENTS.id, LEDGER.id].sort(),
    );
    expect(useAppStore.getState().savedProjectModels[PAYMENTS.id]).toEqual(SAVED);
  });

  it('drops a key whose value is not model settings', async () => {
    await setSetting(storySqlite(), keyOf({ projectId: LEDGER.id }), '{not json');

    await useAppStore.getState().loadSavedProjectModels();

    expect(Object.keys(useAppStore.getState().savedProjectModels)).toEqual([PAYMENTS.id]);
  });

  it('does not bring a discarded project back when an older read lands late', async () => {
    await useAppStore.getState().loadSavedProjectModels();
    const reading = useAppStore.getState().loadSavedProjectModels();

    await useAppStore.getState().discardSavedProjectModels({ projectId: PAYMENTS.id });
    await reading;

    expect(useAppStore.getState().savedProjectModels[PAYMENTS.id]).toBeUndefined();
    expect(useAppStore.getState().savedProjectModels[LEDGER.id]).toEqual(SAVED);
    expect(await getSetting(storySqlite(), keyOf({ projectId: PAYMENTS.id }))).toBeNull();
  });

  it('keeps the key and the store when the write to the workspace page fails', async () => {
    await useAppStore.getState().loadSavedProjectModels();
    useAppStore.setState({
      patchWorkspaceOverrides: async () => {
        throw new Error('settings file is locked');
      },
    });

    await expect(
      useAppStore
        .getState()
        .applySavedProjectModels({ projectId: PAYMENTS.id, workspaceId: WORKSPACE.id }),
    ).rejects.toThrow('locked');

    expect(useAppStore.getState().savedProjectModels[PAYMENTS.id]).toEqual(SAVED);
    expect(await getSetting(storySqlite(), keyOf({ projectId: PAYMENTS.id }))).not.toBeNull();
  });

  it('refuses to apply a project with nothing saved', async () => {
    await expect(
      useAppStore
        .getState()
        .applySavedProjectModels({ projectId: PAYMENTS.id, workspaceId: WORKSPACE.id }),
    ).rejects.toThrow('no saved model settings');
  });
});

describe('parseSavedProjectModels', () => {
  it('reads both maps and skips an entry with an unknown role, task or provider', () => {
    expect(
      parseSavedProjectModels({
        raw: JSON.stringify({
          taskModels: {
            summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
            not_a_task: { providerId: 'anthropic', model: 'x' },
          },
          roleModels: {
            planner: { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
            not_a_role: { providerId: 'codex', model: 'x', effort: 'high' },
            reviewer: { providerId: 'nowhere', model: 'x', effort: 'high' },
          },
        }),
      }),
    ).toEqual({
      taskModels: { summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' } },
      roleModels: { planner: { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'high' } },
    });
  });

  it('is null for empty, whitespace, a scalar, an array and a broken string', () => {
    for (const raw of ['', '   ', '5', '[]', 'null', '{"taskModels":', '{}']) {
      expect(parseSavedProjectModels({ raw })).toBeNull();
    }
  });

  it('reads a very large value without trouble', () => {
    const roleModels = Object.fromEntries(
      Array.from({ length: 20_000 }, (_, index) => [
        `role_${index}`,
        { providerId: 'codex', model: 'x', effort: 'high' },
      ]),
    );

    expect(parseSavedProjectModels({ raw: JSON.stringify({ roleModels }) })).toBeNull();
  });
});
