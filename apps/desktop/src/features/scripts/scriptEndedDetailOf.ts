import { brandId, type SessionId } from '@goodboy/types';
import type { ScriptEndedDetail } from './scriptEndNoticeOf';

type Params = {
  readonly event: Event;
};

type ValueParams = {
  readonly value: unknown;
};

const detailSessionIdOf = ({ value }: ValueParams): SessionId | null =>
  typeof value === 'string' && value !== '' ? brandId<SessionId>({ value }) : null;

export const scriptEndedDetailOf = ({ event }: Params): ScriptEndedDetail | null => {
  if (!(event instanceof CustomEvent)) {
    return null;
  }
  const detail: unknown = event.detail;
  if (typeof detail !== 'object' || detail === null) {
    return null;
  }
  const sessionId = detailSessionIdOf({ value: Reflect.get(detail, 'sessionId') });
  const scriptKey: unknown = Reflect.get(detail, 'scriptKey');
  const runId: unknown = Reflect.get(detail, 'runId');
  if (sessionId === null || typeof scriptKey !== 'string' || typeof runId !== 'string') {
    return null;
  }
  return { sessionId, scriptKey, runId };
};
