import { addCalendarSource as addStoredCalendarSource } from '@goodboy/db';
import type { CalendarSource } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  commitAfterConfirm,
  type CommitResult,
} from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';
import type { AddCalendarSourceParams } from './types';

export const addCalendarSource = ({ set, get }: SliceDeps) => {
  return async ({ source }: AddCalendarSourceParams): Promise<CommitResult<CalendarSource>> => {
    calendarWrites.loads.cancel({ key: calendarWrites.sourcesKey });
    const result = await commitAfterConfirm({
      get,
      failureTitle: "Couldn't connect the calendar",
      target: {},
      step: () => addStoredCalendarSource({ db: tauriDatabase, source }),
      commit: () => undefined,
    });
    if (!result.isOk) {
      return result;
    }
    const stored = result.value;
    set((state) => ({
      calendarSources: [...state.calendarSources.filter((known) => known.id !== stored.id), stored],
    }));
    return result;
  };
};
