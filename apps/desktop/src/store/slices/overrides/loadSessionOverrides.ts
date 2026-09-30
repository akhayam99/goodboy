import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { OverrideSettings, SessionId } from '@goodboy/types';
import type { SetFn } from './types';

export const loadSessionOverrides = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const overrides = await invokeCommand<OverrideSettings | null>('get_session_overrides', {
      sessionId,
    });
    if (overrides) {
      set((state) => ({
        sessionOverrides: { ...state.sessionOverrides, [sessionId]: overrides },
      }));
    }
  };
};
