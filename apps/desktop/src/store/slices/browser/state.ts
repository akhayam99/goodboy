import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import type { BrowserTab, ClosedBrowserTab, DevicePresetId } from './types';

export type BrowserState = {
  readonly browserTabCounts: Readonly<Record<WorkspaceId, number>>;
  readonly browserTabCountFailures: Readonly<Record<WorkspaceId, true>>;
  readonly browserSessionTabs: Readonly<Record<SessionId, ReadonlyArray<BrowserTab>>>;
  readonly browserProjectPins: Readonly<Record<ProjectId, ReadonlyArray<BrowserTab>>>;
  readonly browserActiveTab: Readonly<Record<SessionId, string | null>>;
  readonly browserShownPin: Readonly<Record<SessionId, string | null>>;
  readonly browserLiveTabs: Readonly<Record<SessionId, Readonly<Record<string, string>>>>;
  readonly browserDraftEnds: Readonly<Record<SessionId, number>>;
  readonly browserClosedTabs: Readonly<Record<SessionId, ReadonlyArray<ClosedBrowserTab>>>;
  readonly browserDevicePresets: Readonly<Record<string, DevicePresetId>>;
};

export const browserInitialState: BrowserState = {
  browserTabCounts: {},
  browserTabCountFailures: {},
  browserSessionTabs: {},
  browserProjectPins: {},
  browserActiveTab: {},
  browserShownPin: {},
  browserLiveTabs: {},
  browserDraftEnds: {},
  browserClosedTabs: {},
  browserDevicePresets: {},
};
