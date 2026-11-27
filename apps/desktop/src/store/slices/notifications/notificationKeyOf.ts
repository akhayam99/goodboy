import type { NotificationAction, NotificationKind, NotificationSeverity } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';

type Params = {
  readonly kind: NotificationKind;
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly sessionId?: SessionId;
  readonly workspaceId?: WorkspaceId;
  readonly action?: NotificationAction;
};

type SubjectParams = Pick<Params, 'sessionId' | 'workspaceId' | 'action'>;

const parts = ({ action }: Pick<SubjectParams, 'action'>): ReadonlyArray<string> => {
  if (action === undefined) {
    return [];
  }
  if ('agentId' in action) {
    return [action.agentId];
  }
  if ('mountId' in action && action.mountId !== null) {
    return [action.mountId];
  }
  return [];
};

const keySubjectOf = ({ sessionId, workspaceId, action }: SubjectParams): string =>
  [sessionId ?? workspaceId ?? 'global', ...parts({ action })].join('/');

type CauseParams = {
  readonly title: string;
};

const causeOf = ({ title }: CauseParams): string => title.trim().replace(/\s+/g, ' ');

export const notificationKeyOf = ({ kind, severity, title, ...subject }: Params): string =>
  `${kind}:${keySubjectOf(subject)}:${severity}:${causeOf({ title })}`;
