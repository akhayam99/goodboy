import { invoke } from '@tauri-apps/api/core'
import { save, open } from '@tauri-apps/plugin-dialog'
import type { ConfigBundleImportResult } from '@goodboy/types'

export const exportConfigToFile = async (): Promise<string | null> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const defaultPath = `goodboy-backup-${timestamp}.json`

  const filePath = await save({
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  if (!filePath) {
    return null
  }

  await invoke<void>('export_config_to_file', { path: filePath })
  return filePath
}

export const importConfigFromFile = async (): Promise<ConfigBundleImportResult | null> => {
  const result = await open({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    multiple: false,
    directory: false,
  })

  const filePath = Array.isArray(result) ? result[0] : result
  if (!filePath) {
    return null
  }

  return invoke<ConfigBundleImportResult>('import_config_from_file', { path: filePath })
}
