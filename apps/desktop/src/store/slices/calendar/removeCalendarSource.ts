import { removeCalendarSource as removeStoredCalendarSource } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  commitAfterConfirm,
  type CommitResult,
} from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';
import type { RemoveCalendarSourceParams } from './types';

export const removeCalendarSource = ({ set, get }: SliceDeps) => {
  return ({ sourceId }: RemoveCalendarSourceParams): Promise<CommitResult<boolean>> => {
    calendarWrites.loads.cancel({ key: calendarWrites.sourcesKey });
    return commitAfterConfirm({
      get,
      failureTitle: "Couldn't disconnect the calendar",
      target: {},
      step: () => removeStoredCalendarSource({ db: tauriDatabase, sourceId }),
      commit: () => {
        set((state) => ({
          calendarSources: state.calendarSources.filter((source) => source.id !== sourceId),
          calendarRoles: state.calendarRoles.filter((entry) => entry.sourceId !== sourceId),
          calendarDay:
            state.calendarDay === null
              ? null
              : {
                  range: state.calendarDay.range,
                  events: state.calendarDay.events.filter((event) => event.sourceId !== sourceId),
                  failedSources: state.calendarDay.failedSources.filter(
                    (failure) => failure.sourceId !== sourceId,
                  ),
                },
        }));
      },
    });
  };
};
