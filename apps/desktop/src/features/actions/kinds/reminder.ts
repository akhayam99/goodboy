import { CircleCheck, Clock, SquareArrowOutUpRight } from '@goodboy/ui/icons';
import type { WorkspaceId } from '@goodboy/types';
import { openReminderOwner } from '../../calendar/reminders/openReminderOwner';
import { formatClock } from '../../../shared/utils/time/formatClock';
import { reminderOwnerOf, type ReminderOwner } from '../../calendar/reminders/reminderOwnerOf';
import { snoozeTimesOf, type SnoozeTimes } from '../../calendar/reminders/snoozeTimesOf';
import type { ActionEnv, ObjectKindDefinition, ReminderActionTarget } from '../types';

export type ReminderFacts = ReminderOwner & {
  readonly workspaceId: WorkspaceId;
  readonly snooze: SnoozeTimes;
};

type SnoozeParams = {
  readonly facts: ReminderFacts;
  readonly env: ActionEnv;
  readonly until: number;
};

const snooze = async ({ facts, env, until }: SnoozeParams): Promise<'unchanged' | undefined> => {
  const result = await env.getState().snoozeReminder({
    workspaceId: facts.workspaceId,
    reminderId: facts.reminder.id,
    snoozedUntil: until,
  });
  return result.isOk ? undefined : 'unchanged';
};

export const REMINDER_KIND: ObjectKindDefinition<ReminderActionTarget, ReminderFacts> = {
  noun: 'reminder',
  facts: ({ state, target }) => {
    const reminder = (state.calendarReminders[target.workspaceId] ?? []).find(
      (candidate) => candidate.id === target.reminderId,
    );
    if (reminder === undefined || reminder.doneAt !== null) {
      return null;
    }
    return {
      ...reminderOwnerOf({ state, reminder }),
      workspaceId: target.workspaceId,
      snooze: snoozeTimesOf({ now: Date.now() }),
    };
  },
  actions: [
    {
      id: 'reminder.open',
      label: 'Open',
      icon: SquareArrowOutUpRight,
      group: 'open',
      when: () => true,
      run: ({ facts }) => openReminderOwner({ owner: facts }),
    },
    {
      id: 'reminder.snoozeHour',
      label: 'Snooze for an hour',
      icon: Clock,
      group: 'act',
      when: () => true,
      run: ({ facts, env }) => snooze({ facts, env, until: facts.snooze.inAnHour }),
    },
    {
      id: 'reminder.snoozeTomorrow',
      label: ({ facts }) =>
        `Snooze until tomorrow ${formatClock({ at: facts.snooze.tomorrowMorning })}`,
      icon: Clock,
      group: 'act',
      when: () => true,
      run: ({ facts, env }) => snooze({ facts, env, until: facts.snooze.tomorrowMorning }),
    },
    {
      id: 'reminder.markDone',
      label: 'Mark done',
      icon: CircleCheck,
      group: 'act',
      isUndoable: true,
      when: () => true,
      run: async ({ facts, env }) => {
        const result = await env.getState().markReminderDone({
          workspaceId: facts.workspaceId,
          reminderId: facts.reminder.id,
        });
        return result.isOk ? undefined : 'unchanged';
      },
    },
  ],
};
