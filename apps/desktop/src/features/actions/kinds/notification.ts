import { Bug, Check, Copy, SquareArrowOutUpRight, Trash2, Undo2 } from 'lucide-react';
import type { NotificationSeverity } from '@goodboy/db';
import { openReportSheet } from '../../bug-report/openReportSheet';
import type { NotificationActionTarget, ObjectKindDefinition } from '../types';

type NotificationOpen = {
  readonly label: string;
  readonly run: () => void;
};

export type NotificationFacts = {
  readonly ids: ReadonlyArray<string>;
  readonly unreadIds: ReadonlyArray<string>;
  readonly title: string;
  readonly body: string | null;
  readonly severity: NotificationSeverity;
  readonly open: NotificationOpen | null;
};

type FactsOnly = { readonly facts: NotificationFacts };

const isUnread = ({ facts }: FactsOnly): boolean => facts.unreadIds.length > 0;

const canReport = ({ facts }: FactsOnly): boolean =>
  facts.severity === 'warning' || facts.severity === 'error';

const textOf = ({ facts }: FactsOnly): string =>
  facts.body === null || facts.body === '' ? facts.title : `${facts.title}\n${facts.body}`;

export const NOTIFICATION_KIND: ObjectKindDefinition<NotificationActionTarget, NotificationFacts> =
  {
    noun: 'notification',
    facts: ({ target }) => (target.facts.ids.length === 0 ? null : target.facts),
    actions: [
      {
        id: 'notification.open',
        label: 'Open',
        shortLabel: ({ facts }) => facts.open?.label ?? 'Open',
        icon: SquareArrowOutUpRight,
        group: 'open',
        when: ({ facts }) => facts.open !== null,
        run: ({ facts }) => facts.open?.run(),
      },
      {
        id: 'notification.markRead',
        label: 'Mark read',
        icon: Check,
        group: 'act',
        slot: () => 'hover',
        when: isUnread,
        run: async ({ facts, env }) => {
          for (const id of facts.unreadIds) {
            await env.getState().markNotificationRead(id);
          }
        },
      },
      {
        id: 'notification.markUnread',
        label: 'Mark unread',
        icon: Undo2,
        group: 'act',
        when: ({ facts }) => !isUnread({ facts }),
        run: async ({ facts, env }) => {
          const [latest] = facts.ids;
          if (latest === undefined) {
            return 'unchanged';
          }
          await env.getState().markNotificationUnread(latest);
        },
      },
      {
        id: 'notification.report',
        label: 'Report this',
        icon: Bug,
        group: 'act',
        when: canReport,
        run: ({ facts }) =>
          openReportSheet({ notice: { title: facts.title, body: facts.body ?? '' } }),
      },
      {
        id: 'notification.copyText',
        label: 'Copy text',
        icon: Copy,
        group: 'copy',
        when: () => true,
        run: ({ facts, env }) => env.copyText({ text: textOf({ facts }) }),
      },
      {
        id: 'notification.delete',
        label: 'Delete',
        icon: Trash2,
        group: 'danger',
        isUndoable: true,
        when: () => true,
        run: async ({ facts, env }) => {
          await env.getState().dismissNotificationGroup({ ids: facts.ids });
        },
      },
    ],
  };
