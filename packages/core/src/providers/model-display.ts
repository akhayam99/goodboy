import type { ModelTier, ProviderId } from '@goodboy/types'
import { PROVIDER_CAPABILITIES } from './capabilities'

const PROVIDER_PRIORITY: ReadonlyArray<ProviderId> = ['anthropic', 'codex', 'gemini', 'cursor']

const DESCRIPTOR_BY_ID: ReadonlyMap<string, ModelTier> = (() => {
  const map = new Map<string, ModelTier>()
  for (const provider of PROVIDER_PRIORITY) {
    for (const model of PROVIDER_CAPABILITIES[provider].models) {
      if (!map.has(model.id)) {
        map.set(model.id, model)
      }
    }
  }
  return map
})()

const PROVIDER_BY_MODEL: ReadonlyMap<string, ProviderId> = (() => {
  const map = new Map<string, ProviderId>()
  for (const provider of PROVIDER_PRIORITY) {
    for (const model of PROVIDER_CAPABILITIES[provider].models) {
      if (!map.has(model.id)) {
        map.set(model.id, provider)
      }
    }
  }
  return map
})()

export const getModelDescriptor = (id: string): ModelTier | null => {
  return DESCRIPTOR_BY_ID.get(id) ?? null
}

export const getModelProvider = (id: string): ProviderId | null => {
  return PROVIDER_BY_MODEL.get(id) ?? null
}
