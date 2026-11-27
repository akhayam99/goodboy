import { useEffect, useState } from 'react';
import type { CalendarEvent, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { startPoll } from '../../../../../shared/lib/usePoll/startPoll';
import { reportChipError } from '../../../chip/reportChipError';
import { listCalendarEvents } from '../../../listCalendarEvents';

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly today: number;
};

const DAY_MS = 86_400_000;
const LONGEST_LOOK_BACK_MS = 360 * DAY_MS;
const LOAD_EVERY_MS = 5 * 60_000;

export const useCallEndEvents = ({ workspaceId, today }: Params): ReadonlyArray<CalendarEvent> => {
  const [events, setEvents] = useState<ReadonlyArray<CalendarEvent>>(EMPTY_ARRAY);
  const sources = useAppStore((state) => state.calendarSources);
  const oldestAt = useAppStore((state) => {
    if (workspaceId === null) {
      return null;
    }
    const waiting = (state.calendarReminders[workspaceId] ?? EMPTY_ARRAY).filter(
      (reminder) =>
        reminder.trigger === 'call_end' && reminder.doneAt === null && reminder.dueAt === null,
    );
    return waiting.length === 0 ? null : Math.min(...waiting.map((reminder) => reminder.createdAt));
  });
  const isWaiting = oldestAt !== null;

  useEffect(() => {
    if (!isWaiting) {
      return;
    }
    void useAppStore.getState().loadCalendarSources();
  }, [isWaiting]);

  useEffect(() => {
    if (oldestAt === null || sources.length === 0) {
      return;
    }
    let isLive = true;
    let latest = 0;
    const load = async (): Promise<void> => {
      latest += 1;
      const mine = latest;
      const now = Date.now();
      const listed = await listCalendarEvents({
        sources: sources.map((source) => ({ id: source.id, kind: source.kind })),
        from: Math.max(oldestAt - DAY_MS, now - LONGEST_LOOK_BACK_MS),
        to: now + DAY_MS,
      });
      if (!isLive || mine !== latest) {
        return;
      }
      setEvents(listed.items);
    };
    const run = (): void => {
      load().catch((error: unknown) =>
        reportChipError({ title: "Couldn't check whether your call ended", error }),
      );
    };
    const stopPoll = startPoll({ run, everyMs: LOAD_EVERY_MS, gate: 'always', isImmediate: true });
    return () => {
      isLive = false;
      stopPoll();
    };
  }, [oldestAt, sources, today]);

  return events;
};
