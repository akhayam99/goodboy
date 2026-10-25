import type { SessionBudgetOnExceed, SessionId } from '@goodboy/types';
import { invokeSessionBudgetSet } from '../../../features/budget/budget';
import { currentAutoDrivePort } from '../../../features/auto/autoDrivePort';
import { pausingSessionCapOf } from '../../../features/budget/pausingSessionCapOf';
import { tauriDatabase } from '../../../shared/lib/db';
import { lowerAutoLimitsToSession } from '../../runtime/auto/lowerAutoLimitsToSession';
import type { GetFn, SetFn } from '../../slice-types';

type FailureParams = {
  readonly error: unknown;
};

const LOWER_FAILED = 'The session limit is set, but a running Auto kept its larger limit';

export const setSessionBudget = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    softCapUsd: number,
    onExceed: SessionBudgetOnExceed = 'pause',
  ) => {
    const budget = await invokeSessionBudgetSet(sessionId, softCapUsd, onExceed);
    set((state) => ({
      sessionBudgets: { ...state.sessionBudgets, [sessionId]: budget },
    }));
    const capUsd = pausingSessionCapOf({ budget });
    if (capUsd === null) {
      return;
    }
    const reportError = ({ error }: FailureParams) => {
      void get().reportError({ title: LOWER_FAILED, error, sessionId });
    };
    try {
      const lowered = await lowerAutoLimitsToSession({
        db: tauriDatabase,
        sessionId,
        capUsd,
        nowMs: Date.now(),
        drive: currentAutoDrivePort(),
        onDriveError: reportError,
      });
      if (lowered.length > 0) {
        await get().loadAutoTrees({ sessionId });
      }
    } catch (error) {
      reportError({ error });
    }
  };
};
