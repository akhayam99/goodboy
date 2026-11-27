import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { dayStartOf } from '../../dayStartOf';
import { listCalendarEvents } from '../../listCalendarEvents';
import { weekRangeOf } from '../../weekRangeOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly now: number;
};

export const useCalendarLoad = ({ workspaceId, now }: Params): boolean => {
  const [isReady, setIsReady] = useState(false);
  const sources = useAppStore((state) => state.calendarSources);
  const roles = useAppStore((state) => state.calendarRoles);
  const today = dayStartOf({ at: now });

  useEffect(() => {
    let isLive = true;
    void useAppStore
      .getState()
      .loadCalendarSources()
      .then(() => {
        if (isLive) {
          setIsReady(true);
        }
      });
    return () => {
      isLive = false;
    };
  }, []);

  useEffect(() => {
    void useAppStore.getState().loadReminders({ workspaceId, doneSince: today });
  }, [workspaceId, today]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    void useAppStore
      .getState()
      .loadCalendarEvents({ range: weekRangeOf({ now: today }), listEvents: listCalendarEvents });
  }, [isReady, sources, roles, today]);

  return isReady;
};
