import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import type { ConfigBundle, ConfigBundleImportResult } from '@kay-am/types';

export async function invokeExportConfig(): Promise<ConfigBundle> {
  return invoke<ConfigBundle>('export_config');
}

export async function invokeImportConfig(bundle: ConfigBundle): Promise<ConfigBundleImportResult> {
  return invoke<ConfigBundleImportResult>('import_config', { bundle });
}

export async function exportConfigToFile(): Promise<string | null> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultPath = `kay-am-backup-${timestamp}.json`;

  const filePath = await save({
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (!filePath) return null;

  await invoke<void>('export_config_to_file', { path: filePath });
  return filePath;
}

export async function importConfigFromFile(): Promise<ConfigBundleImportResult | null> {
  const result = await open({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    multiple: false,
    directory: false,
  });

  const filePath = Array.isArray(result) ? result[0] : result;
  if (!filePath) return null;

  return invoke<ConfigBundleImportResult>('import_config_from_file', { path: filePath });
}
