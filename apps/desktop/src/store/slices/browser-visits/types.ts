import type { SessionId } from '@goodboy/types';

export type BrowserVisit = {
  readonly url: string;
  readonly title: string;
  readonly visitedAt: number;
};

export type LoadVisitsParams = {
  readonly sessionId: SessionId;
};
