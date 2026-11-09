import type { ProjectId, SessionId } from '@goodboy/types';
import type { BrowserTab } from './types';

export type BrowserState = {
  readonly browserSessionTabs: Readonly<Record<SessionId, ReadonlyArray<BrowserTab>>>;
  readonly browserProjectPins: Readonly<Record<ProjectId, ReadonlyArray<BrowserTab>>>;
  readonly browserActiveTab: Readonly<Record<SessionId, string | null>>;
};

export const browserInitialState: BrowserState = {
  browserSessionTabs: {},
  browserProjectPins: {},
  browserActiveTab: {},
};
