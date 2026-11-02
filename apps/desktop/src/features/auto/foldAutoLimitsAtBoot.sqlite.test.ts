// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace, setWorkspaceValue } from '@goodboy/db';
import { brandId, DEFAULT_WORKFLOW_RULES, type WorkspaceId } from '@goodboy/types';
import { EMPTY_OVERRIDES, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../store/storyHarness';
import { readAutoTreeLimit } from './autoTreeLimit';
import { foldAutoLimitsAtBoot } from './foldAutoLimitsAtBoot';
import { startAutoLimitFold } from './startAutoLimitFold';

const HARBORLINE = aWorkspace({
  id: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
  name: 'Harborline',
  slug: 'harborline',
});
const NORTHWIND = aWorkspace({
  id: brandId<WorkspaceId>({ value: 'workspace-northwind' }),
  name: 'Northwind',
  slug: 'northwind',
});

let useAppStore: StoryStore;

type OverridesParams = {
  readonly workspaceId: WorkspaceId;
  readonly spendLimitUsd: number | null;
};

const overridesOf = ({ workspaceId, spendLimitUsd }: OverridesParams) => ({
  [workspaceId]: {
    ...EMPTY_OVERRIDES,
    workflowRules: { ...DEFAULT_WORKFLOW_RULES, spendLimitUsd },
  },
});

type RunLimitParams = {
  readonly workspaceId: WorkspaceId;
};

const runLimitOf = ({ workspaceId }: RunLimitParams) =>
  useAppStore.getState().workspaceOverrides[workspaceId]?.workflowRules?.spendLimitUsd;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: HARBORLINE });
  await insertWorkspace({ db, workspace: NORTHWIND });
  await setWorkspaceValue({ db, workspaceId: HARBORLINE.id, key: 'auto.treeLimitUsd', value: '8' });
  await setWorkspaceValue({ db, workspaceId: NORTHWIND.id, key: 'auto.treeLimitUsd', value: '40' });
  useAppStore.setState({
    workspaces: [HARBORLINE, NORTHWIND],
    workspaceOverrides: {},
    loadWorkspaceOverrides: async (workspaceId: WorkspaceId) => {
      useAppStore.setState((state) => ({
        workspaceOverrides: {
          ...state.workspaceOverrides,
          ...(state.workspaceOverrides[workspaceId] === undefined
            ? overridesOf({
                workspaceId,
                spendLimitUsd: workspaceId === NORTHWIND.id ? 25 : null,
              })
            : {}),
        },
      }));
    },
    patchWorkspaceOverrides: async ({ workspaceId, patch }) => {
      useAppStore.setState((state) => ({
        workspaceOverrides: {
          ...state.workspaceOverrides,
          [workspaceId]: { ...EMPTY_OVERRIDES, ...patch },
        },
      }));
    },
  });
});

describe('folding the Auto limit of every workspace at boot', () => {
  it('moves each stored Auto limit into its Run defaults limit and clears the old key', async () => {
    await foldAutoLimitsAtBoot();

    expect(runLimitOf({ workspaceId: HARBORLINE.id })).toBe(8);
    expect(runLimitOf({ workspaceId: NORTHWIND.id })).toBe(25);
    const db = storySqlite();
    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE.id })).toBeNull();
    expect(await readAutoTreeLimit({ db, workspaceId: NORTHWIND.id })).toBeNull();
  });

  it('is idempotent, so a second boot leaves a later Run defaults edit alone', async () => {
    await foldAutoLimitsAtBoot();
    useAppStore.setState({
      workspaceOverrides: overridesOf({ workspaceId: HARBORLINE.id, spendLimitUsd: 3 }),
    });

    await foldAutoLimitsAtBoot();

    expect(runLimitOf({ workspaceId: HARBORLINE.id })).toBe(3);
  });

  it('keeps the old key and reports the error when saving the Run defaults limit fails', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({
      reportError,
      patchWorkspaceOverrides: async () => {
        throw new Error('disk full');
      },
    });

    await foldAutoLimitsAtBoot();

    expect(reportError).toHaveBeenCalledTimes(2);
    const db = storySqlite();
    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE.id })).toBe(8);
    expect(await readAutoTreeLimit({ db, workspaceId: NORTHWIND.id })).toBe(40);
  });

  it('starts once the app is hydrated and never again', async () => {
    useAppStore.setState({ hydrated: false });
    const stop = startAutoLimitFold();
    expect(useAppStore.getState().workspaceOverrides).toEqual({});

    useAppStore.setState({ hydrated: true });
    await vi.waitFor(() => expect(runLimitOf({ workspaceId: HARBORLINE.id })).toBe(8));
    useAppStore.setState({
      workspaceOverrides: overridesOf({ workspaceId: HARBORLINE.id, spendLimitUsd: 3 }),
    });
    useAppStore.setState({ hydrated: false });
    useAppStore.setState({ hydrated: true });

    expect(runLimitOf({ workspaceId: HARBORLINE.id })).toBe(3);
    stop();
  });

  it('skips a workspace whose Run defaults did not load', async () => {
    useAppStore.setState({ loadWorkspaceOverrides: async () => undefined });

    await foldAutoLimitsAtBoot();

    expect(await readAutoTreeLimit({ db: storySqlite(), workspaceId: HARBORLINE.id })).toBe(8);
    expect(useAppStore.getState().workspaceOverrides).toEqual({});
  });
});
