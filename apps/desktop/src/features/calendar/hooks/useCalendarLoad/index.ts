import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { startPoll } from '../../../../shared/lib/usePoll/startPoll';
import { dayStartOf } from '../../dayStartOf';
import { listCalendarEvents } from '../../listCalendarEvents';
import { weekRangeOf } from '../../weekRangeOf';

const RELOAD_EVERY_MS = 5 * 60_000;

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
    const run = (): void => {
      void useAppStore
        .getState()
        .loadCalendarEvents({ range: weekRangeOf({ now: today }), listEvents: listCalendarEvents });
    };
    return startPoll({ run, everyMs: RELOAD_EVERY_MS, gate: 'visible', isImmediate: true });
  }, [isReady, sources, roles, today]);

  return isReady;
};
