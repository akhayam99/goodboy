import { updateNudgeEventOutcome, type NudgeOutcome } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type { IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

export const recordOutcome = async (id: string, outcome: NudgeOutcome): Promise<void> => {
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
};
