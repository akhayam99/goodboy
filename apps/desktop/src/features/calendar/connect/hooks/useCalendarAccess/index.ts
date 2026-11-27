import { useEffect, useState } from 'react';
import type { CalendarAccessState } from '@goodboy/types';
import { calendarCommands } from '../../calendarCommands';

type Params = {
  readonly isMac: boolean;
};

type CalendarAccess = {
  readonly access: CalendarAccessState | null;
  readonly setAccess: (access: CalendarAccessState) => void;
};

export const useCalendarAccess = ({ isMac }: Params): CalendarAccess => {
  const [access, setAccess] = useState<CalendarAccessState | null>(isMac ? null : 'unsupported');

  useEffect(() => {
    if (!isMac) {
      return;
    }
    let isCurrent = true;
    calendarCommands
      .accessState()
      .then((state) => {
        if (isCurrent) {
          setAccess(state);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setAccess('not-determined');
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [isMac]);

  return { access, setAccess };
};
