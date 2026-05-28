import { invoke } from '@tauri-apps/api/core';
import type { OverrideSettings, SessionId } from '@goodboy/types';
import type { SetFn } from './types';

export function loadSessionOverrides(set: SetFn) {
  return async (sessionId: SessionId) => {
    const overrides = await invoke<OverrideSettings | null>('get_session_overrides', { sessionId });
    if (overrides) {
      set((state) => ({
        sessionOverrides: { ...state.sessionOverrides, [sessionId]: overrides },
      }));
    }
  };
}
