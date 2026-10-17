import { Trash2 } from 'lucide-react';
import type { NotificationsActionTarget, ObjectKindDefinition } from '../types';

export type NotificationsFacts = {
  readonly totalCount: number;
  readonly workspaceName: string | null;
  readonly onDeleteAll: () => Promise<void>;
};

type CountParams = {
  readonly count: number;
};

const countWord = ({ count }: CountParams): string =>
  `${count} ${count === 1 ? 'notification' : 'notifications'}`;

export const NOTIFICATIONS_KIND: ObjectKindDefinition<
  NotificationsActionTarget,
  NotificationsFacts
> = {
  noun: 'notifications',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'notifications.deleteAll',
      label: 'Delete all',
      icon: Trash2,
      group: 'danger',
      when: ({ facts }) => facts.totalCount > 0,
      confirm: ({ facts }) => ({
        title: `Delete ${countWord({ count: facts.totalCount })}?`,
        description: `Clears the log ${
          facts.workspaceName === null ? 'in every workspace' : `in ${facts.workspaceName}`
        }, read and unread. This can't be undone.`,
        confirmLabel: `Delete ${facts.totalCount}`,
        role: 'danger',
      }),
      run: ({ facts }) => facts.onDeleteAll(),
    },
  ],
};
