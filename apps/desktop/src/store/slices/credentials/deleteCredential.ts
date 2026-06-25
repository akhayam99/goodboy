import { invoke } from '@tauri-apps/api/core'
import { deleteProviderCredential } from '@goodboy/db'
import type { CredentialId, OverrideSettings, WorkspaceId } from '@goodboy/types'
import { tauriDatabase } from '../../../shared/lib/db'
import { credentialSecretKey } from './credentialKey'
import type { GetFn, SetFn } from './types'

export const deleteCredential = (set: SetFn, get: GetFn) => {
  return async (id: CredentialId): Promise<void> => {
    await invoke('secret_delete', { key: credentialSecretKey(id) })
    await deleteProviderCredential(tauriDatabase, id)

    const nextOverrides = { ...get().workspaceOverrides }
    const scrubbed: Array<[WorkspaceId, OverrideSettings]> = []
    for (const [wsId, override] of Object.entries(get().workspaceOverrides)) {
      const bindings = override.providerBindings
      if (!bindings || !Object.values(bindings).includes(id)) {
        continue
      }
      const cleaned = Object.fromEntries(
        Object.entries(bindings).filter(([, credId]) => credId !== id),
      )
      const next: OverrideSettings = {
        ...override,
        providerBindings: Object.keys(cleaned).length > 0 ? cleaned : null,
      }
      nextOverrides[wsId as WorkspaceId] = next
      scrubbed.push([wsId as WorkspaceId, next])
    }

    for (const [wsId, override] of scrubbed) {
      await invoke('set_workspace_overrides', { workspaceId: wsId, overrides: override })
    }

    set((state) => ({
      providerCredentials: state.providerCredentials.filter((c) => c.id !== id),
      workspaceOverrides: nextOverrides,
    }))
  }
}
