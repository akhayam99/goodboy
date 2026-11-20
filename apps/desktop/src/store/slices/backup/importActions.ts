import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { listProjectsForWorkspace, listWorkspaces } from '@goodboy/db';
import {
  chooseImportFile,
  configImportApply,
  configImportPreview,
} from '../../../features/settings/config-export';
import type { WildcardConsentParams } from '../../../features/backup/wildcardConsent';
import { SETTING_EDITOR_BINARY } from '../../../features/settings/settings';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from '../../slice-types';
import { CHECK_STATE, NOTHING_CHANGED } from '../notifications/errorRecovery';
import { importFailureTitleOf } from './importFailureTitleOf';

type FileChangedParams = {
  readonly error: unknown;
};

const isFileChanged = ({ error }: FileChangedParams): boolean =>
  typeof error === 'object' && error !== null && 'kind' in error && error.kind === 'file_changed';

export const loadBackupImportPreview = (set: SetFn, get: GetFn) => {
  const load = async (): Promise<boolean> => {
    const path = get().backupImportPath;
    if (path === null) {
      return false;
    }
    set({ backupImportPhase: 'previewing' });
    try {
      const preview = await configImportPreview({
        path,
        projectParent: get().backupImportProjectParent,
      });
      if (get().backupImportPath !== path) {
        return false;
      }
      set({
        backupImportPreview: preview,
        hasBackupImportWildcardConsent: false,
        backupImportPhase: 'idle',
      });
      return true;
    } catch (error: unknown) {
      set({ backupImportPhase: 'idle' });
      const title = importFailureTitleOf({ error, title: "Couldn't open the backup file" });
      void get().reportError({
        title,
        error,
        recovery: NOTHING_CHANGED,
        ...(title === "Couldn't find the backup file" ? {} : { retry: load }),
      });
      return false;
    }
  };
  return load;
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
      hasBackupImportWildcardConsent: false,
      backupImportResult: null,
      backupExportPhase: 'idle',
      backupExportedPath: null,
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

type SetBackupImportWildcardConsentParams = {
  readonly set: SetFn;
};

export const setBackupImportWildcardConsent = ({ set }: SetBackupImportWildcardConsentParams) => {
  return ({ isAccepted }: WildcardConsentParams): void => {
    set({ hasBackupImportWildcardConsent: isAccepted });
  };
};

export const applyBackupImport = (set: SetFn, get: GetFn) => {
  const apply = async (): Promise<boolean> => {
    const path = get().backupImportPath;
    const preview = get().backupImportPreview;
    if (path === null || preview === null) {
      return false;
    }
    set({ backupImportPhase: 'applying' });
    try {
      const result = await configImportApply({
        path,
        workspaceTargets: get().backupImportWorkspaceTargets,
        resolvedProjectPaths: get().backupImportResolvedPaths,
        expectedSha256: preview.sha256,
        hasWildcardConsent: get().hasBackupImportWildcardConsent,
      });
      if (!result.ok) {
        set({ backupImportPhase: 'idle' });
        void get().reportError({
          title: "Couldn't import the backup",
          error: result.errors.map((failure) => failure.message).join('\n'),
          recovery: NOTHING_CHANGED,
        });
        return false;
      }
      set({ backupImportResult: result, backupImportPhase: 'done' });
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
        ...workspaces.map((workspace) =>
          get()
            .loadPhaseTemplates(workspace.id)
            .catch(() => undefined),
        ),
        get()
          .loadBudgetRules()
          .catch(() => undefined),
        get()
          .loadSetting(SETTING_EDITOR_BINARY)
          .catch(() => undefined),
      ]);
      return true;
    } catch (error: unknown) {
      set({ backupImportPhase: 'idle' });
      const title = importFailureTitleOf({ error, title: "Couldn't import the backup" });
      const isMissing = title === "Couldn't find the backup file";
      void get().reportError({
        title,
        error,
        recovery: isMissing ? NOTHING_CHANGED : CHECK_STATE,
        ...(isMissing
          ? {}
          : {
              retry: isFileChanged({ error }) ? loadBackupImportPreview(set, get) : apply,
            }),
      });
      return false;
    }
  };
  return apply;
};

export const resetBackupImport = (set: SetFn) => {
  return (): void => {
    set({
      backupImportPath: null,
      backupImportProjectParent: null,
      backupImportPreview: null,
      backupImportWorkspaceTargets: {},
      backupImportResolvedPaths: {},
      hasBackupImportWildcardConsent: false,
      backupImportPhase: 'idle',
      backupImportResult: null,
    });
  };
};
