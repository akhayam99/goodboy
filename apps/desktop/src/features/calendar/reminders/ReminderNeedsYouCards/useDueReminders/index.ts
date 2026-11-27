import { useMemo } from 'react';
import type { Reminder, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useNow } from '../../../../../shared/hooks/useNow';
import { dueRemindersOf } from '../../dueRemindersOf';

type Params = {
  readonly workspaceId: WorkspaceId;
};

const DUE_CLOCK_MS = 30_000;

export const useDueReminders = ({ workspaceId }: Params): ReadonlyArray<Reminder> => {
  const reminders = useAppStore((state) => state.calendarReminders[workspaceId] ?? EMPTY_ARRAY);
  const now = useNow(DUE_CLOCK_MS);
  return useMemo(() => dueRemindersOf({ reminders, now }), [reminders, now]);
};
