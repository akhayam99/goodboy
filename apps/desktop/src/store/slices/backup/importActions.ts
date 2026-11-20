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

const BACKUP_IMPORT_FAILURE_KEY = 'backup-import-failed';

type PreviewRequest = {
  readonly path: string;
  readonly projectParent: string | null;
};

type PreviewParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly request: PreviewRequest;
};

type SameParams = {
  readonly get: GetFn;
  readonly request: PreviewRequest;
};

const isSamePreview = ({ get, request }: SameParams): boolean =>
  get().backupImportPath === request.path &&
  get().backupImportProjectParent === request.projectParent;

const previewBackupImport = async ({ set, get, request }: PreviewParams): Promise<boolean> => {
  set({ backupImportPhase: 'previewing' });
  try {
    const preview = await configImportPreview(request);
    if (get().backupImportPath !== request.path) {
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
      coalesceKey: BACKUP_IMPORT_FAILURE_KEY,
      ...(title === "Couldn't find the backup file"
        ? {}
        : { retry: () => retryPreview({ set, get, request }) }),
    });
    return false;
  }
};

const retryPreview = async ({ set, get, request }: PreviewParams): Promise<boolean> =>
  isSamePreview({ get, request }) && (await previewBackupImport({ set, get, request }));

export const loadBackupImportPreview = (set: SetFn, get: GetFn) => {
  return async (): Promise<boolean> => {
    const path = get().backupImportPath;
    if (path === null) {
      return false;
    }
    return previewBackupImport({
      set,
      get,
      request: { path, projectParent: get().backupImportProjectParent },
    });
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
      hasBackupImportWildcardConsent: false,
      backupImportResult: null,
      backupExportPhase: 'idle',
      backupExportedPath: null,
    });
    void get().resolveNotifications([BACKUP_IMPORT_FAILURE_KEY]);
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

type ApplyRequest = PreviewRequest & {
  readonly workspaceTargets: Readonly<Record<string, string>>;
  readonly resolvedProjectPaths: Readonly<Record<string, string>>;
  readonly expectedSha256: string;
  readonly hasWildcardConsent: boolean;
};

type ApplyParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly request: ApplyRequest;
};

const retryApply = async ({ set, get, request }: ApplyParams): Promise<boolean> =>
  get().backupImportPath === request.path && (await applyImportRequest({ set, get, request }));

const applyImportRequest = async ({ set, get, request }: ApplyParams): Promise<boolean> => {
  set({ backupImportPhase: 'applying' });
  try {
    const result = await configImportApply({
      path: request.path,
      workspaceTargets: request.workspaceTargets,
      resolvedProjectPaths: request.resolvedProjectPaths,
      expectedSha256: request.expectedSha256,
      hasWildcardConsent: request.hasWildcardConsent,
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
    const preview = { path: request.path, projectParent: request.projectParent };
    void get().reportError({
      title,
      error,
      recovery: isMissing ? NOTHING_CHANGED : CHECK_STATE,
      coalesceKey: BACKUP_IMPORT_FAILURE_KEY,
      ...(isMissing
        ? {}
        : {
            retry: isFileChanged({ error })
              ? () => retryPreview({ set, get, request: preview })
              : () => retryApply({ set, get, request }),
          }),
    });
    return false;
  }
};

export const applyBackupImport = (set: SetFn, get: GetFn) => {
  return async (): Promise<boolean> => {
    const state = get();
    const path = state.backupImportPath;
    const preview = state.backupImportPreview;
    if (path === null || preview === null) {
      return false;
    }
    return applyImportRequest({
      set,
      get,
      request: {
        path,
        projectParent: state.backupImportProjectParent,
        workspaceTargets: state.backupImportWorkspaceTargets,
        resolvedProjectPaths: state.backupImportResolvedPaths,
        expectedSha256: preview.sha256,
        hasWildcardConsent: state.hasBackupImportWildcardConsent,
      },
    });
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
      hasBackupImportWildcardConsent: false,
      backupImportPhase: 'idle',
      backupImportResult: null,
    });
  };
};
