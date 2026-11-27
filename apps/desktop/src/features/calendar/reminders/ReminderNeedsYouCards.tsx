import { useMemo } from 'react';
import type { Reminder, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useNow } from '../../../shared/hooks/useNow';
import { joinFacts } from '../../../shared/utils/joinFacts';
import { formatSpan } from '../../../shared/utils/time/formatSpan';
import { ObjectMenuArea } from '../../actions/ObjectMenuArea';
import { runObjectAction } from '../../actions/registry';
import { useActionEnv } from '../../actions/useActionEnv';
import type { ReminderActionTarget } from '../../actions/types';
import { reminderOwnerOf } from './reminderOwnerOf';
import { ReminderNeedsYouCard } from './ReminderNeedsYouCard';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly reminders: ReadonlyArray<Reminder>;
};

type MetaParams = {
  readonly reminder: Reminder;
  readonly now: number;
};

const AGE_MS = 30_000;

const metaOf = ({ reminder, now }: MetaParams): string => {
  const since = Math.max(reminder.dueAt ?? 0, reminder.snoozedUntil ?? 0);
  const age = formatSpan({ from: since, to: now });
  return joinFacts({ facts: ['Reminder', age === '' ? null : `Waiting ${age}`] });
};

export const ReminderNeedsYouCards = ({ workspaceId, reminders }: Props) => {
  const now = useNow(AGE_MS);
  const env = useActionEnv({ origin: 'button' });
  const sessions = useAppStore((state) => state.sessions);
  const calendarDay = useAppStore((state) => state.calendarDay);
  const calendarRoles = useAppStore((state) => state.calendarRoles);
  const owners = useMemo(
    () =>
      reminders.map((reminder) =>
        reminderOwnerOf({ state: { sessions, calendarDay, calendarRoles }, reminder }),
      ),
    [reminders, sessions, calendarDay, calendarRoles],
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
          meta={metaOf({ reminder: owner.reminder, now })}
          onOpen={() => {
            void runObjectAction({ target, actionId: 'reminder.open', env });
          }}
        />
      </ObjectMenuArea>
    );
  });
};
