import { recordSessionId } from './recordSessionId';
import type { InboxRecord } from './types';

type AssignedParams = {
  readonly record: InboxRecord;
};

export const isAssignedRecord = ({ record }: AssignedParams): boolean => {
  switch (record.provider) {
    case 'github':
      return true;
    case 'linear':
      return (
        record.payload.provider === 'linear' &&
        record.payload.issue.assignee !== null &&
        record.payload.issue.assignee !== undefined
      );
    case 'jira':
      return record.payload.provider === 'jira' && record.payload.issue.assignee !== null;
    case 'gitlab':
      return record.kind === 'issue';
    case 'sentry':
    case 'slack':
    case 'bitbucket':
      return false;
    default: {
      const exhaustive: never = record.provider;
      return exhaustive;
    }
  }
};

type ForMeParams = AssignedParams & {
  readonly isStarred: boolean;
};

export const isForMeRecord = ({ record, isStarred }: ForMeParams): boolean =>
  isStarred || recordSessionId({ record }) !== null || isAssignedRecord({ record });
