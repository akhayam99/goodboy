import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

export function dismissScriptResult(set: SetFn) {
  return (sessionId: SessionId) =>
    set((state) => ({
      sessionScriptResult: { ...state.sessionScriptResult, [sessionId]: null },
    }));
}
