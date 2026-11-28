import type { WorkspaceId } from '@goodboy/types';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';

type WorkspaceKeyParams = {
  readonly workspaceId: WorkspaceId;
};

export const calendarWrites = {
  loads: createLatestOnly(),
  roles: createSerialQueue(),
  sourcesKey: 'calendar-sources',
  dayKey: 'calendar-day',
  remindersKey: ({ workspaceId }: WorkspaceKeyParams) => `calendar-reminders:${workspaceId}`,
};
