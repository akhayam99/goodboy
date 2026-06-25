import { hydrate } from './hydrate'
import { loadDetectedEditors } from './loadDetectedEditors'
import type { GetFn, SetFn } from './types'

export const createBootSlice = (set: SetFn, get: GetFn) => {
  return {
    hydrate: hydrate(set, get),
    loadDetectedEditors: loadDetectedEditors(set, get),
  }
}
