import type { SessionId } from '@goodboy/types';
import type { BrowserVisit } from './types';

export type BrowserVisitsState = {
  readonly browserVisits: Readonly<Record<SessionId, ReadonlyArray<BrowserVisit>>>;
};

export const browserVisitsInitialState: BrowserVisitsState = {
  browserVisits: {},
};
