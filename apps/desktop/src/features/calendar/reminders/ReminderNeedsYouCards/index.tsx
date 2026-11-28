import { useMemo } from 'react';
import type { Reminder, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { ObjectMenuArea } from '../../../actions/ObjectMenuArea';
import type { ReminderActionTarget } from '../../../actions/types';
import { openReminderOwner } from '../openReminderOwner';
import { reminderOwnerOf } from '../reminderOwnerOf';
import { ReminderNeedsYouCard } from './ReminderNeedsYouCard';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly reminders: ReadonlyArray<Reminder>;
};

type WaitParams = {
  readonly reminder: Reminder;
  readonly now: number;
};

const AGE_MS = 30_000;

const waitLineOf = ({ reminder, now }: WaitParams): string => {
  const since = Math.max(reminder.dueAt ?? 0, reminder.snoozedUntil ?? 0);
  const age = formatSpan({ from: since, to: now });
  return joinFacts({ facts: ['Reminder', age === '' ? null : `Waiting ${age}`] });
};

export const ReminderNeedsYouCards = ({ workspaceId, reminders }: Props) => {
  const now = useNow(AGE_MS);
  const sessions = useAppStore((state) => state.sessions);
  const archived = useAppStore((state) => state.archivedSessions[workspaceId] ?? EMPTY_ARRAY);
  const calendarDay = useAppStore((state) => state.calendarDay);
  const calendarRoles = useAppStore((state) => state.calendarRoles);
  const owners = useMemo(
    () =>
      reminders.map((reminder) =>
        reminderOwnerOf({
          state: {
            sessions,
            archivedSessions: { [workspaceId]: archived },
            calendarDay,
            calendarRoles,
          },
          reminder,
        }),
      ),
    [reminders, sessions, archived, workspaceId, calendarDay, calendarRoles],
  );

  return owners.map((owner) => {
    const target: ReminderActionTarget = {
      kind: 'reminder',
      workspaceId,
      reminderId: owner.reminder.id,
    };
    return (
      <ObjectMenuArea key={owner.reminder.id} target={target} anchorKey={owner.reminder.id}>
        <ReminderNeedsYouCard
          reminderId={owner.reminder.id}
          title={owner.reminder.text}
          context={owner.context}
          meta={waitLineOf({ reminder: owner.reminder, now })}
          onOpen={() => openReminderOwner({ owner })}
        />
      </ObjectMenuArea>
    );
  });
};
