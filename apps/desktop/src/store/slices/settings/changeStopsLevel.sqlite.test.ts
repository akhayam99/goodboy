// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const { announced } = vi.hoisted(() => ({
  announced: new Array<{ readonly kind: string; readonly key?: string }>(),
}));

vi.mock('../../../shared/lib/dataChanged', () => ({
  announceDataChanged: async ({
    change,
  }: {
    readonly change: { readonly kind: string; readonly key?: string };
  }) => {
    announced.push(change);
  },
  listenDataChanged: async () => () => undefined,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import { DEFAULT_WORKFLOW_RULES, brandId, type WorkspaceId } from '@goodboy/types';
import { EMPTY_OVERRIDES } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { readAutoLevel } from '../../runtime/auto/level/readAutoLevel';
import { writeAutoLevel } from '../../runtime/auto/level/writeAutoLevel';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const TARGET = { workspaceId: WORKSPACE };

let useAppStore: StoryStore;

const workflowAutonomy = () =>
  useAppStore.getState().workspaceOverrides[WORKSPACE]?.workflowRules?.autonomy;

const patchCount = () =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'patch_workspace_overrides').length;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  announced.length = 0;
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
  await writeAutoLevel({ db: storySqlite(), target: TARGET, level: 'plan' });
  stubStoryInvoke({ patch_workspace_overrides: null });
  useAppStore.setState({
    workspaceOverrides: {
      [WORKSPACE]: {
        ...EMPTY_OVERRIDES,
        workflowRules: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'step', spendLimitUsd: 12 },
      },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('changeStopsLevel', () => {
  it('starts from workflows at every step and the Lead after the plan, then writes one level', async () => {
    await useAppStore.getState().changeStopsLevel({ workspaceId: WORKSPACE, level: 'run' });

    expect(await readAutoLevel({ db: storySqlite(), target: TARGET })).toBe('run');
    expect(workflowAutonomy()).toBe('run');
    expect(patchCount()).toBe(1);
    expect(useAppStore.getState().workspaceOverrides[WORKSPACE]?.workflowRules).toMatchObject({
      spendLimitUsd: 12,
    });
    const held = useAppStore.getState().workspaceValues[WORKSPACE]?.['auto.level'] ?? '';
    expect(JSON.parse(held).defaultLevel).toBe('run');
  });

  it('tells the other windows to read both keys again once both are written', async () => {
    await useAppStore.getState().changeStopsLevel({ workspaceId: WORKSPACE, level: 'run' });

    expect(announced).toEqual([
      { kind: 'workspace', workspaceId: WORKSPACE, key: 'auto.level' },
      { kind: 'workspace', workspaceId: WORKSPACE, key: 'overrides' },
    ]);
  });

  it('puts the workflow level back and keeps the Lead level when the Lead write fails', async () => {
    vi.spyOn(storySqlite(), 'execute').mockRejectedValueOnce(new Error('disk unavailable'));

    await expect(
      useAppStore.getState().changeStopsLevel({ workspaceId: WORKSPACE, level: 'run' }),
    ).rejects.toThrow('disk unavailable');

    expect(await readAutoLevel({ db: storySqlite(), target: TARGET })).toBe('plan');
    expect(workflowAutonomy()).toBe('step');
    expect(patchCount()).toBe(2);
  });

  it('writes nothing to the Lead when the workflow write fails', async () => {
    stubStoryInvoke({
      patch_workspace_overrides: () => {
        throw new Error('database is locked');
      },
    });

    await expect(
      useAppStore.getState().changeStopsLevel({ workspaceId: WORKSPACE, level: 'run' }),
    ).rejects.toThrow('database is locked');

    expect(await readAutoLevel({ db: storySqlite(), target: TARGET })).toBe('plan');
    expect(workflowAutonomy()).toBe('step');
  });
});
