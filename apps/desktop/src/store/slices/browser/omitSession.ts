import type { SessionId } from '@goodboy/types';

type Params<Value> = {
  readonly record: Readonly<Record<SessionId, Value>>;
  readonly sessionId: SessionId;
};

export const omitSession = <Value>({
  record,
  sessionId,
}: Params<Value>): Readonly<Record<SessionId, Value>> => {
  const next = { ...record };
  delete next[sessionId];
  return next;
};
