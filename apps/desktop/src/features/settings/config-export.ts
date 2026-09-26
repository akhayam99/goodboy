import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import type {
  ExportGroups,
  ExportPreview,
  ImportPreview,
  ConfigBundleImportResult,
} from '@goodboy/types';

export const chooseExportFile = async (): Promise<string | null> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultPath = `goodboy-setup-${timestamp}.json`;
  const filePath = await save({
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  return filePath ?? null;
};

export const chooseImportFile = async (): Promise<string | null> => {
  const result = await open({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    multiple: false,
    directory: false,
  });
  const filePath = Array.isArray(result) ? result[0] : result;
  return filePath ?? null;
};

type ExportPreviewParams = {
  readonly groups: ExportGroups;
};

export const configExportPreview = async ({
  groups,
}: ExportPreviewParams): Promise<ExportPreview> => {
  return invoke<ExportPreview>('config_export_preview', { groups });
};

type ExportWriteParams = {
  readonly path: string;
  readonly groups: ExportGroups;
  readonly leaveOut: ReadonlyArray<string>;
};

export const configExportWrite = async ({
  path,
  groups,
  leaveOut,
}: ExportWriteParams): Promise<void> => {
  await invoke<void>('config_export_write', { path, groups, leaveOut });
};

type ImportPreviewParams = {
  readonly path: string;
  readonly projectParent: string | null;
};

export const configImportPreview = async ({
  path,
  projectParent,
}: ImportPreviewParams): Promise<ImportPreview> => {
  return invoke<ImportPreview>('config_import_preview', { path, projectParent });
};

type ImportApplyParams = {
  readonly path: string;
  readonly workspaceTargets: Readonly<Record<string, string>>;
  readonly resolvedProjectPaths: Readonly<Record<string, string>>;
};

export const configImportApply = async ({
  path,
  workspaceTargets,
  resolvedProjectPaths,
}: ImportApplyParams): Promise<ConfigBundleImportResult> => {
  return invoke<ConfigBundleImportResult>('config_import_apply', {
    path,
    workspaceTargets,
    resolvedProjectPaths,
  });
};
