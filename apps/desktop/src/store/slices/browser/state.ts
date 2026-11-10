import type { ProjectId, SessionId } from '@goodboy/types';
import type { BrowserPasskeyAsk, BrowserTab } from './types';

export type BrowserState = {
  readonly browserSessionTabs: Readonly<Record<SessionId, ReadonlyArray<BrowserTab>>>;
  readonly browserProjectPins: Readonly<Record<ProjectId, ReadonlyArray<BrowserTab>>>;
  readonly browserActiveTab: Readonly<Record<SessionId, string | null>>;
  readonly browserShownPin: Readonly<Record<SessionId, string | null>>;
  readonly browserLiveTabs: Readonly<Record<SessionId, Readonly<Record<string, string>>>>;
  readonly browserDraftEnds: Readonly<Record<SessionId, number>>;
  readonly browserPasskeyAsks: Readonly<
    Record<SessionId, Readonly<Record<string, BrowserPasskeyAsk>>>
  >;
};

export const browserInitialState: BrowserState = {
  browserSessionTabs: {},
  browserProjectPins: {},
  browserActiveTab: {},
  browserShownPin: {},
  browserLiveTabs: {},
  browserDraftEnds: {},
  browserPasskeyAsks: {},
};
