import { formatError } from '@goodboy/ui';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { listProjectsForWorkspace, listWorkspaces } from '@goodboy/db';
import {
  chooseImportFile,
  configImportApply,
  configImportPreview,
} from '../../../features/settings/config-export';
import { SETTING_EDITOR_BINARY } from '../../../features/settings/settings';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from '../../slice-types';

export const loadBackupImportPreview = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const path = get().backupImportPath;
    if (path === null) {
      return;
    }
    set({ backupImportPhase: 'previewing', backupImportError: null });
    try {
      const preview = await configImportPreview({
        path,
        projectParent: get().backupImportProjectParent,
      });
      set({ backupImportPreview: preview, backupImportPhase: 'idle' });
    } catch (error: unknown) {
      set({
        backupImportPhase: 'error',
        backupImportError: formatError(error),
      });
    }
  };
};

export const chooseBackupImportFile = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const path = await chooseImportFile();
    if (path === null) {
      return;
    }
    set({
      backupImportPath: path,
      backupImportPreview: null,
      backupImportWorkspaceTargets: {},
      backupImportResolvedPaths: {},
      backupImportResult: null,
      backupImportError: null,
    });
    await loadBackupImportPreview(set, get)();
  };
};

export const chooseBackupImportProjectParent = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== 'string' || picked.length === 0) {
      return;
    }
    set({ backupImportProjectParent: picked });
    await loadBackupImportPreview(set, get)();
  };
};

export const setBackupImportWorkspaceTarget = (set: SetFn, get: GetFn) => {
  return ({
    bundleId,
    targetId,
  }: {
    readonly bundleId: string;
    readonly targetId: string | null;
  }): void => {
    const current = { ...get().backupImportWorkspaceTargets };
    if (targetId === null) {
      delete current[bundleId];
      set({ backupImportWorkspaceTargets: current });
      return;
    }
    current[bundleId] = targetId;
    set({ backupImportWorkspaceTargets: current });
  };
};

export const setBackupImportResolvedPath = (set: SetFn, get: GetFn) => {
  return ({ projectId, path }: { readonly projectId: string; readonly path: string }): void => {
    set({
      backupImportResolvedPaths: { ...get().backupImportResolvedPaths, [projectId]: path },
    });
  };
};

export const applyBackupImport = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const path = get().backupImportPath;
    if (path === null) {
      return;
    }
    set({ backupImportPhase: 'applying', backupImportError: null });
    try {
      const result = await configImportApply({
        path,
        workspaceTargets: get().backupImportWorkspaceTargets,
        resolvedProjectPaths: get().backupImportResolvedPaths,
      });
      set({ backupImportResult: result, backupImportPhase: result.ok ? 'done' : 'error' });
      if (!result.ok) {
        return;
      }
      const workspaces = await listWorkspaces({ db: tauriDatabase });
      const projects = (
        await Promise.all(
          workspaces.map((workspace) =>
            listProjectsForWorkspace({ db: tauriDatabase, workspaceId: workspace.id }),
          ),
        )
      ).flat();
      set({ workspaces, projects });
      await Promise.all([
        ...workspaces.flatMap((workspace) => [
          get()
            .loadPhaseTemplates(workspace.id)
            .catch(() => undefined),
          get()
            .rescanSkills(workspace.id)
            .catch(() => undefined),
        ]),
        get()
          .loadBudgetRules()
          .catch(() => undefined),
        get()
          .loadSetting(SETTING_EDITOR_BINARY)
          .catch(() => undefined),
      ]);
    } catch (error: unknown) {
      set({
        backupImportPhase: 'error',
        backupImportError: formatError(error),
      });
    }
  };
};

export const resetBackupImport = (set: SetFn) => {
  return (): void => {
    set({
      backupImportPath: null,
      backupImportProjectParent: null,
      backupImportPreview: null,
      backupImportWorkspaceTargets: {},
      backupImportResolvedPaths: {},
      backupImportPhase: 'idle',
      backupImportError: null,
      backupImportResult: null,
    });
  };
};
