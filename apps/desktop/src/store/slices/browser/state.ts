import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import type { BrowserTab, ClosedBrowserTab } from './types';

export type BrowserState = {
  readonly browserTabCounts: Readonly<Record<WorkspaceId, number>>;
  readonly browserSessionTabs: Readonly<Record<SessionId, ReadonlyArray<BrowserTab>>>;
  readonly browserProjectPins: Readonly<Record<ProjectId, ReadonlyArray<BrowserTab>>>;
  readonly browserActiveTab: Readonly<Record<SessionId, string | null>>;
  readonly browserShownPin: Readonly<Record<SessionId, string | null>>;
  readonly browserLiveTabs: Readonly<Record<SessionId, Readonly<Record<string, string>>>>;
  readonly browserDraftEnds: Readonly<Record<SessionId, number>>;
  readonly browserClosedTabs: Readonly<Record<SessionId, ReadonlyArray<ClosedBrowserTab>>>;
};

export const browserInitialState: BrowserState = {
  browserTabCounts: {},
  browserSessionTabs: {},
  browserProjectPins: {},
  browserActiveTab: {},
  browserShownPin: {},
  browserLiveTabs: {},
  browserDraftEnds: {},
  browserClosedTabs: {},
};
