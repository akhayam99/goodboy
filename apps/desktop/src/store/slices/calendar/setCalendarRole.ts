import { setCalendarRole as storeCalendarRole } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  commitAfterConfirm,
  type CommitResult,
} from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';
import { eventsWithRoles } from './eventsWithRoles';
import type { SetCalendarRoleParams } from './types';

const SOURCE_GONE = 'This calendar is no longer connected.';

export const setCalendarRole = ({ set, get }: SliceDeps) => {
  return ({ entry }: SetCalendarRoleParams): Promise<CommitResult<boolean>> => {
    calendarWrites.loads.cancel({ key: calendarWrites.sourcesKey });
    return calendarWrites.roles.run({
      key: `${entry.sourceId}:${entry.calendarId}`,
      task: () =>
        commitAfterConfirm({
          get,
          failureTitle: "Couldn't change how the calendar shows",
          target: {},
          step: async () => {
            const isStored = await storeCalendarRole({ db: tauriDatabase, entry });
            if (!isStored) {
              throw new Error(SOURCE_GONE);
            }
            return isStored;
          },
          commit: () => {
            set((state) => {
              const roles = [
                ...state.calendarRoles.filter(
                  (known) =>
                    known.sourceId !== entry.sourceId || known.calendarId !== entry.calendarId,
                ),
                entry,
              ];
              const day = state.calendarDay;
              return {
                calendarRoles: roles,
                calendarDay:
                  day === null
                    ? null
                    : { ...day, events: eventsWithRoles({ events: day.events, roles }) },
              };
            });
          },
        }),
    });
  };
};
