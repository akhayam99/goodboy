import { updateNudgeEventOutcome, type NudgeOutcome } from '@goodboy/db';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../shared/lib/db';
import { formatError } from '../../shared/lib/errors';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

async function recordOutcome(id: string, outcome: NudgeOutcome): Promise<void> {
  try {
    await updateNudgeEventOutcome(
      tauriDatabase,
      id,
      outcome,
      new Date().toISOString() as IsoDateTime,
    );
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[nudge-event] update failed: ${formatError(err)}`);
    }
  }
}

export function createNudgesSlice(set: SetFn, get: GetFn) {
  return {
    dismissSessionNudge: async (
      sessionId: SessionId,
      outcome: 'accepted' | 'dismissed' = 'dismissed',
    ) => {
      const nudge = get().sessionNudges[sessionId] ?? null;
      if (!nudge) return;
      set((state) => ({
        sessionNudges: { ...state.sessionNudges, [sessionId]: null },
      }));
      await recordOutcome(nudge.id, outcome);
    },

    acceptSessionNudgeHandoff: async (sessionId: SessionId) => {
      const nudge = get().sessionNudges[sessionId] ?? null;
      if (!nudge) return;
      set((state) => ({
        sessionNudges: { ...state.sessionNudges, [sessionId]: null },
      }));
      await recordOutcome(nudge.id, 'accepted');
      if (nudge.kind === 'plan-ready') {
        if (nudge.planId !== null) {
          await get().spawnAgent(sessionId, {
            triggeredPlanId: nudge.planId,
            kindOverride: 'implementer',
          });
        } else {
          await get().spawnAgent(sessionId, { kindOverride: 'implementer' });
        }
      } else {
        await get().spawnAgent(sessionId, {
          kindOverride: nudge.targetKind,
          ...(nudge.planId !== null && { triggeredPlanId: nudge.planId }),
        });
      }
    },
  };
}
