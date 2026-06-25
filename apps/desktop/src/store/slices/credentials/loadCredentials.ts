import { listProviderCredentials } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const loadCredentials = (set: SetFn) => {
  return async (): Promise<void> => {
    const credentials = await listProviderCredentials(tauriDatabase)
    set({ providerCredentials: credentials })
  }
}
