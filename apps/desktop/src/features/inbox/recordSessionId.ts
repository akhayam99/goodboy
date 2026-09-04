import type { SessionId } from '@goodboy/types';
import type { InboxRecord } from './types';

type Params = { readonly record: InboxRecord };

export const recordSessionId = ({ record }: Params): SessionId | null => {
  const payload = record.payload;
  switch (payload.provider) {
    case 'github':
      return payload.sessionId;
    case 'gitlab':
      return payload.kind === 'issue' ? payload.sessionId : null;
    case 'linear':
      return payload.sessionId;
    case 'jira':
      return payload.sessionId;
    case 'sentry':
      return payload.sessionId;
    case 'slack':
      return payload.sessionId;
    case 'bitbucket':
      return null;
    default: {
      const exhaustive: never = payload;
      return exhaustive;
    }
  }
};
