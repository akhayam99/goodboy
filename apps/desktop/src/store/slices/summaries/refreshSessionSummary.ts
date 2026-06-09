import type { SessionId } from '@goodboy/types';
import { summarizeSessionTelemetry } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const refreshSessionSummary = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const summary = await summarizeSessionTelemetry(tauriDatabase, sessionId);
    set({ sessionSummary: summary });
  };
};
