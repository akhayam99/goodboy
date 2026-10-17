// @vitest-environment happy-dom

const { dialog } = vi.hoisted(() => ({
  dialog: { open: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: dialog.open }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { useLinkRepoHere } from './index';

let useAppStore: StoryStore;

const HARBORLINE = aWorkspace({
  id: brandId<WorkspaceId>({ value: 'ws-harborline' }),
  name: 'Harborline',
});
const NORTHWIND = aWorkspace({
  id: brandId<WorkspaceId>({ value: 'ws-northwind' }),
  name: 'Northwind',
});
const LEDGER = aProject({
  workspaceId: HARBORLINE.id,
  name: 'ledger-core',
  kind: 'repo',
  rootPath: '/work/ledger-core',
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  dialog.open.mockReset();
});

afterEach(cleanup);

const link = async (): Promise<void> => {
  const { result } = renderHook(() => useLinkRepoHere({ workspace: HARBORLINE }));
  await act(async () => {
    await result.current();
  });
};

describe('useLinkRepoHere', () => {
  it('does nothing when the folder picker is closed', async () => {
    const addProject = vi.fn();
    useAppStore.setState({ addProject });

    await link();

    expect(addProject).not.toHaveBeenCalled();
  });

  it('links the picked repository to the named workspace and offers an undo that unlinks it', async () => {
    dialog.open.mockResolvedValueOnce('/work/ledger-core');
    const addProject = vi.fn(async () => ({ kind: 'linked' as const, project: LEDGER }));
    const removeProject = vi.fn(async () => undefined);
    useAppStore.setState({ addProject, removeProject });

    await link();

    expect(addProject).toHaveBeenCalledWith({
      workspaceId: HARBORLINE.id,
      rootPath: '/work/ledger-core',
      requireRepo: true,
    });
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    expect(useAppStore.getState().undoNotices.at(-1)?.toast.message).toBe(
      'Linked ledger-core to Harborline',
    );
    await act(async () => {
      await useAppStore.getState().undoLastOperation({});
    });
    expect(removeProject).toHaveBeenCalledWith({ projectId: LEDGER.id });
  });

  it('reports a folder that is not a repository and links nothing', async () => {
    dialog.open.mockResolvedValueOnce('/notes');
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({
      addProject: vi.fn(async () => {
        throw new Error('No git repository at /notes.');
      }),
      reportError,
    });

    await link();

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't link the folder to Harborline",
        workspaceId: HARBORLINE.id,
      }),
    );
    expect(useAppStore.getState().undoStack).toHaveLength(0);
  });

  it('leaves a repository of another workspace where it is', async () => {
    dialog.open.mockResolvedValueOnce('/work/ledger-core');
    const removeProject = vi.fn(async () => undefined);
    useAppStore.setState({
      addProject: vi.fn(async () => ({
        kind: 'conflict' as const,
        conflict: {
          project: { ...LEDGER, workspaceId: NORTHWIND.id },
          sourceWorkspace: NORTHWIND,
          sessionCount: 1,
          isShell: false,
        },
      })),
      removeProject,
    });

    await link();

    expect(useAppStore.getState().undoStack).toHaveLength(0);
    expect(removeProject).not.toHaveBeenCalled();
  });
});
