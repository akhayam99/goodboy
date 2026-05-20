import { Ban, CheckCheck, Construction, Hourglass, type LucideIcon } from 'lucide-react';
import type { SessionUserStatus } from '@goodboy/types';

export const SESSION_STATUS_ORDER: ReadonlyArray<SessionUserStatus> = [
  'wip',
  'waiting',
  'blocked',
  'done',
];

export const SESSION_STATUS_DEFAULT: SessionUserStatus = 'wip';

interface SessionStatusEntry {
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly className: string;
}

export const SESSION_STATUS_PALETTE: Record<SessionUserStatus, SessionStatusEntry> = {
  wip: {
    label: 'in progress',
    description: 'work in progress',
    icon: Construction,
    className: 'text-warning',
  },
  waiting: {
    label: 'waiting',
    description: 'waiting on something',
    icon: Hourglass,
    className: 'text-muted-foreground',
  },
  blocked: {
    label: 'blocked',
    description: 'blocked',
    icon: Ban,
    className: 'text-danger',
  },
  done: {
    label: 'done',
    description: 'work completed',
    icon: CheckCheck,
    className: 'text-success',
  },
};
