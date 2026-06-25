import type { ContextSlot, SessionId } from '@goodboy/types'
import type { SlotKey } from '@goodboy/core'
import { upsertContextSlot } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import { mergeSlots, type GetFn, type SetFn } from './types'

export const toggleSessionSlot = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, key: SlotKey, enabled: boolean) => {
    const existing = get().sessionSlots[sessionId] ?? []
    const prev = existing.find((s) => s.key === key)
    const next: ContextSlot = { key, value: prev?.value ?? '', enabled }
    await upsertContextSlot(tauriDatabase, sessionId, next)
    set((state) => ({
      sessionSlots: {
        ...state.sessionSlots,
        [sessionId]: mergeSlots(state.sessionSlots[sessionId] ?? [], next),
      },
    }))
  }
}
