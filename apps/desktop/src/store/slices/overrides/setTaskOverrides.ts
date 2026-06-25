import { invoke } from '@tauri-apps/api/core'
import type { OverrideSettings, SessionId } from '@goodboy/types'
import type { SetFn } from './types'

export const setTaskOverrides = (set: SetFn) => {
  return async (sessionId: SessionId, overrides: OverrideSettings) => {
    await invoke('set_session_overrides', { sessionId, overrides })
    set((state) => ({
      sessionOverrides: { ...state.sessionOverrides, [sessionId]: overrides },
    }))
  }
}
