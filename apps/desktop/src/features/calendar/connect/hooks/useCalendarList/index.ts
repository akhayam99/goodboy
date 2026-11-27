import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalendarInfo, CalendarSourceFailure, CalendarSourceRef } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { calendarCommands } from '../../calendarCommands';

type Params = {
  readonly sources: ReadonlyArray<CalendarSourceRef>;
};

type Listing = {
  readonly calendars: ReadonlyArray<CalendarInfo>;
  readonly failures: ReadonlyArray<CalendarSourceFailure>;
  readonly error: string | null;
  readonly isLoading: boolean;
};

type CalendarListing = Listing & {
  readonly reload: () => void;
};

const EMPTY: Listing = { calendars: [], failures: [], error: null, isLoading: false };

export const useCalendarList = ({ sources }: Params): CalendarListing => {
  const [listing, setListing] = useState<Listing>(EMPTY);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    if (sources.length === 0) {
      setListing(EMPTY);
      return;
    }
    setListing((current) => ({ ...current, error: null, isLoading: true }));
    calendarCommands
      .listCalendars({ sources })
      .then((found) => {
        if (requestRef.current !== request) {
          return;
        }
        setListing({
          calendars: found.items,
          failures: found.failedSources,
          error: null,
          isLoading: false,
        });
      })
      .catch((error: unknown) => {
        if (requestRef.current !== request) {
          return;
        }
        setListing((current) => ({ ...current, error: formatError(error), isLoading: false }));
      });
  }, [sources, attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  return { ...listing, reload };
};
