import { createCredential } from './createCredential'
import { deleteCredential } from './deleteCredential'
import { loadCredentials } from './loadCredentials'
import { renameCredential } from './renameCredential'
import type { GetFn, SetFn } from './types'

export const createCredentialsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadCredentials: loadCredentials(set),
    createCredential: createCredential(set),
    deleteCredential: deleteCredential(set, get),
    renameCredential: renameCredential(set),
  }
}
