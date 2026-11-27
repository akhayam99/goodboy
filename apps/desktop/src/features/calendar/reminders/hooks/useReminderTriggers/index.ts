import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ReminderId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useNow } from '../../../../../shared/hooks/useNow';
import { dayStartOf } from '../../../dayStartOf';
import { isTriggerHeld } from '../../isTriggerHeld';
import { useCallEndEvents } from '../useCallEndEvents';

type Params = Record<never, never>;

const TRIGGER_CLOCK_MS = 30_000;

export const useReminderTriggers = ({}: Params): void => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const now = useNow(TRIGGER_CLOCK_MS);
  const today = dayStartOf({ at: now });
  const attempted = useRef(new Set<ReminderId>());
  const callEvents = useCallEndEvents({ workspaceId, today });

  useEffect(() => {
    attempted.current.clear();
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId === null) {
      return;
    }
    void useAppStore.getState().loadReminders({ workspaceId, doneSince: today });
  }, [workspaceId, today]);

  const held = useAppStore(
    useShallow((state) =>
      workspaceId === null
        ? EMPTY_ARRAY
        : (state.calendarReminders[workspaceId] ?? EMPTY_ARRAY)
            .filter((reminder) => isTriggerHeld({ state, reminder, callEvents, now }))
            .map((reminder) => reminder.id),
    ),
  );

  useEffect(() => {
    if (workspaceId === null) {
      return;
    }
    for (const reminderId of held) {
      if (attempted.current.has(reminderId)) {
        continue;
      }
      attempted.current.add(reminderId);
      void useAppStore.getState().fireReminder({ workspaceId, reminderId, firedAt: now });
    }
  }, [held, workspaceId, now]);
};
