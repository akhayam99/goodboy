import { Checkbox, ListGrid, ListGridRow, SectionLabel, type ListGridColumn } from '@goodboy/ui';
import type { Reminder, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { reminderWhenOf } from '../../reminderWhenOf';
import { ReminderInput } from './ReminderInput';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly now: number;
};

const COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'done', width: 16 },
  { key: 'text', width: 'fill', isTitle: true },
  { key: 'when', width: 128, align: 'end', isNumeric: true, tone: 'hint' },
];

type TextParams = {
  readonly reminder: Reminder;
};

const textCellOf = ({ reminder }: TextParams) =>
  reminder.doneAt === null ? (
    reminder.text
  ) : (
    <span className="truncate text-faint-foreground line-through">{reminder.text}</span>
  );

export const CalendarReminders = ({ workspaceId, now }: Props) => {
  const reminders = useAppStore((state) => state.calendarReminders[workspaceId] ?? EMPTY_ARRAY);
  const markDone = useAppStore((state) => state.markReminderDone);
  const openCount = reminders.filter((reminder) => reminder.doneAt === null).length;

  return (
    <section aria-label="Reminders" className="flex min-w-0 flex-col gap-2">
      <SectionLabel
        label="Reminders"
        headingLevel={2}
        {...(openCount > 0 && { count: openCount })}
      />
      {reminders.length === 0 ? null : (
        <ListGrid label="Reminders" columns={COLUMNS}>
          {reminders.map((reminder) => {
            const isDone = reminder.doneAt !== null;
            return (
              <ListGridRow
                key={reminder.id}
                rowKey={reminder.id}
                cells={{
                  byKey: {
                    done: (
                      <Checkbox
                        checked={isDone}
                        disabled={isDone}
                        ariaLabel={`Mark done: ${reminder.text}`}
                        onChange={(isChecked) => {
                          if (!isChecked) {
                            return;
                          }
                          void markDone({ workspaceId, reminderId: reminder.id });
                        }}
                      />
                    ),
                    text: textCellOf({ reminder }),
                    when: reminderWhenOf({ reminder, now }),
                  },
                }}
              />
            );
          })}
        </ListGrid>
      )}
      <ReminderInput workspaceId={workspaceId} now={now} />
    </section>
  );
};
