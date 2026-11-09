import type { SessionId } from '@goodboy/types';
import { createLatestOnly } from '../../store/runtime/state-writes/latestOnly';

type SessionKeyParams = {
  readonly sessionId: SessionId;
};

export const browserPaneRequests = {
  opens: createLatestOnly(),
  facts: createLatestOnly(),
  waking: new Map<string, Promise<string | null>>(),
  openKey: ({ sessionId }: SessionKeyParams) => `open:${sessionId}`,
  factsKey: ({ sessionId }: SessionKeyParams) => `facts:${sessionId}`,
};
