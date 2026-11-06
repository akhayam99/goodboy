import type { NotificationAction } from '@goodboy/db';

export type NotificationPlaceReason = Extract<NotificationAction, { kind: 'open-place' }>['reason'];
