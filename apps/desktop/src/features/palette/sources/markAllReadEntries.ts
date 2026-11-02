import { MailOpen } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import type { PaletteEntry } from '../types';

type MarkReadParams = {
  readonly sessionIds: ReadonlyArray<SessionId>;
};

type Params = MarkReadParams & {
  readonly markRead: (params: MarkReadParams) => Promise<void>;
};

export const markAllReadEntries = ({
  sessionIds,
  markRead,
}: Params): ReadonlyArray<PaletteEntry> =>
  sessionIds.length === 0
    ? []
    : [
        {
          key: 'action:mark-all-sessions-read',
          label: 'Mark all sessions as read',
          secondary: ['Mark all as read', 'Clear unread'],
          kind: 'action',
          group: 'action',
          icon: MailOpen,
          run: () => void markRead({ sessionIds }),
        },
      ];
