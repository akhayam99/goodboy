import type { NotificationKind } from '@goodboy/db';

export type NotificationSource =
  'agents' | 'sessions' | 'pull-requests' | 'budget' | 'providers' | 'system';

export const NOTIFICATION_SOURCES = [
  'agents',
  'sessions',
  'pull-requests',
  'budget',
  'providers',
  'system',
] as const satisfies ReadonlyArray<NotificationSource>;

export const NOTIFICATION_SOURCE_LABEL = {
  agents: 'Agents and workflows',
  sessions: 'Sessions',
  'pull-requests': 'Pull requests',
  budget: 'Budget',
  providers: 'Providers',
  system: 'System',
} satisfies Record<NotificationSource, string>;

type NotificationSourceParams = {
  readonly kind: NotificationKind;
  readonly hasSession: boolean;
};

export const notificationSource = ({
  kind,
  hasSession,
}: NotificationSourceParams): NotificationSource => {
  switch (kind) {
    case 'summarizer-success':
    case 'summarizer-degraded':
    case 'agent-auto-spawn':
    case 'boundary-drift':
      return 'agents';
    case 'session-created':
    case 'session-deleted':
    case 'title-generation':
    case 'branch-changed':
      return 'sessions';
    case 'pr-created':
      return 'pull-requests';
    case 'budget-cap':
      return 'budget';
    case 'provider-connected':
      return 'providers';
    case 'workspace-deleted':
    case 'workspace-merged':
    case 'project-adopted':
    case 'orphan-worktrees':
      return 'system';
    case 'error':
      return hasSession ? 'sessions' : 'system';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};
