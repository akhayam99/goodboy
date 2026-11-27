import type { Reminder } from '@goodboy/types';

type Params = {
  readonly reminders: ReadonlyArray<Reminder>;
};

type CompareParams = {
  readonly left: Reminder;
  readonly right: Reminder;
};

const compareReminders = ({ left, right }: CompareParams): number => {
  if (left.dueAt !== right.dueAt) {
    if (left.dueAt === null) {
      return 1;
    }
    if (right.dueAt === null) {
      return -1;
    }
    return left.dueAt - right.dueAt;
  }
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
};

export const sortReminders = ({ reminders }: Params): ReadonlyArray<Reminder> =>
  [...reminders].sort((left, right) => compareReminders({ left, right }));
