import { failureStandingOf } from '@goodboy/core/attention';
import { repairSessionErrorState } from '@goodboy/db/session-error-repair';
import type { SessionId, TurnState } from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { tauriDatabase } from '../../../shared/lib/db';
import { CHECK_STATE } from '../notifications/errorRecovery';
import { sessionSettleOf } from '../session-view/settle/sessionSettleOf';
import type { GetFn, SetFn } from './types';

const STANDING_FAILED_KEY = 'settle-standing-failed';

type FactoryParams = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type Params = {
  readonly sessionId: SessionId | null;
};

type StandingParams = {
  readonly sessionId: SessionId;
};

export const settleAttention = ({ set, get }: FactoryParams) => {
  const settleStanding = async ({ sessionId }: StandingParams): Promise<void> => {
    const state = get();
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (session === undefined || session.state.kind !== 'error') {
      return;
    }
    const { settledAt } = sessionSettleOf({ state, sessionId });
    const standing = failureStandingOf({
      agents: state.sessionPhaseRuns[sessionId] ?? [],
      settledAt,
    });
    if (!standing.isEnded) {
      return;
    }
    const isRepaired = await repairSessionErrorState({ db: tauriDatabase, sessionId });
    if (!isRepaired) {
      return;
    }
    const resting: TurnState = { kind: 'idle', lastActivityAt: isoNow() };
    set((current) => ({
      sessions: current.sessions.map((candidate) =>
        candidate.id === sessionId && candidate.state.kind === 'error'
          ? { ...candidate, state: resting }
          : candidate,
      ),
    }));
  };

  return async ({ sessionId }: Params): Promise<void> => {
    if (sessionId !== null) {
      try {
        await settleStanding({ sessionId });
      } catch (error) {
        await get().reportError({
          recovery: CHECK_STATE,
          title: "Couldn't tidy the session state",
          error,
          coalesceKey: STANDING_FAILED_KEY,
        });
      }
    }
    await get().settleStaleNotifications();
  };
};
