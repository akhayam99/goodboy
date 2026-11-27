import type { ProjectId, SessionId } from '@goodboy/types';
import type { BrowserTab, DevicePresetId } from '../../store/slices/browser/types';

export type BrowserTabState = 'live' | 'asleep' | 'closed';

export type BrowserTabFacts = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly url: string;
  readonly title: string;
  readonly state: BrowserTabState;
  readonly isShown: boolean;
  readonly hiddenSinceMs: number | null;
  readonly openerId: string | null;
  readonly isPasskeyBlocked: boolean;
};

export type BrowserHistoryState = {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
};

export type BrowserFindOutcome = {
  readonly isFound: boolean;
};

export type BrowserConsoleKind = 'console' | 'network';

export type BrowserToolsTab = BrowserConsoleKind | 'errors';

export type BrowserEntryKind = BrowserConsoleKind | 'error';

export type BrowserConsoleLevel = 'log' | 'info' | 'warn' | 'error';

export type BrowserRequestType =
  'fetch' | 'xhr' | 'doc' | 'script' | 'style' | 'img' | 'ws' | 'sse' | 'other';

export type BrowserHeader = {
  readonly name: string;
  readonly value: string;
};

export type BrowserSocketFacts = {
  readonly phase: 'open' | 'closed';
  readonly sent: number;
  readonly received: number;
  readonly code: number | null;
};

export type BrowserRequestPhases = {
  readonly wait: number;
  readonly download: number;
};

export type BrowserRequestFacts = {
  readonly id: string;
  readonly type: BrowserRequestType;
  readonly start: number;
  readonly duration: number | null;
  readonly size: number | null;
  readonly requestHeaders: ReadonlyArray<BrowserHeader>;
  readonly responseHeaders: ReadonlyArray<BrowserHeader>;
  readonly requestBody: string | null;
  readonly responseBody: string | null;
  readonly isRequestBodyCut?: boolean;
  readonly isResponseBodyCut?: boolean;
  readonly socket: BrowserSocketFacts | null;
  readonly phases?: BrowserRequestPhases | null;
};

export type BrowserErrorOrigin = 'uncaught' | 'rejection' | 'console' | 'request';

export type BrowserErrorFacts = {
  readonly origin: BrowserErrorOrigin;
  readonly stack: string | null;
  readonly requestId: string | null;
  readonly at: number | null;
};

export type BrowserConsoleEntry = {
  readonly seq: number;
  readonly kind: BrowserEntryKind;
  readonly level: BrowserConsoleLevel;
  readonly text: string;
  readonly source: string | null;
  readonly method: string | null;
  readonly status: number | null;
  readonly network: BrowserRequestFacts | null;
  readonly error: BrowserErrorFacts | null;
};

export type BrowserConsoleRead = {
  readonly doc: string | null;
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
  readonly watermark: number;
  readonly isHeard: boolean;
};

export type BrowserPickRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type BrowserPickedElement = {
  readonly tag: string;
  readonly label: string;
  readonly selector: string;
  readonly text: string;
  readonly html: string;
  readonly isHtmlCut: boolean;
  readonly styles: ReadonlyArray<{ readonly name: string; readonly value: string }>;
  readonly component: string | null;
  readonly source: { readonly path: string; readonly line: number } | null;
  readonly isSourceSettled: boolean;
  readonly rect: BrowserPickRect | null;
  readonly url: string;
};

export type BrowserPickRead = {
  readonly doc: string | null;
  readonly isHeard: boolean;
  readonly isOn: boolean;
  readonly isLeft: boolean;
  readonly round: number;
  readonly scale: number;
  readonly picks: ReadonlyArray<BrowserPickedElement>;
};

export type BrowserPickOp = 'start' | 'stop' | 'read';

export type BrowserPageText = {
  readonly title: string;
  readonly url: string;
  readonly text: string;
  readonly isCut: boolean;
};

export type BrowserPageSend = {
  readonly label: string;
  readonly canSend: boolean;
  readonly canSendTab: (params: TabParams) => boolean;
  readonly isBusy: boolean;
  readonly runKey: string;
  readonly send: (params: TabParams) => void;
  readonly sendShown: () => void;
  readonly retry: () => void;
};

export type BrowserTabFavicon = {
  readonly origin: string;
  readonly src: string | null;
};

export type BrowserSiteCleared = {
  readonly host: string;
  readonly extraHosts: ReadonlyArray<string>;
  readonly scope: 'site' | 'workspace';
};

export type BrowserProfileCleared = {
  readonly shouldRestart: boolean;
};

export type BrowserTabLoad = {
  readonly tabId: string;
  readonly phase: 'started' | 'finished';
  readonly url: string;
};

export type BrowserBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type ShownTab = {
  readonly tab: BrowserTab;
  readonly isPin: boolean;
};

export type WantedView = {
  readonly tab: BrowserTab;
  readonly bounds: BrowserBounds;
};

type TabParams = {
  readonly tab: BrowserTab;
};

type LiveIdParams = {
  readonly liveId: string | undefined;
};

type TextParams = {
  readonly text: string;
};

type DevicePresetParams = {
  readonly preset: DevicePresetId;
};

type ErrorParams = {
  readonly error: unknown;
};

export type FindParams = TextParams & {
  readonly isBackwards: boolean;
};

export type BrowserConsoleToggle = {
  readonly isOpen: boolean;
  readonly onToggle: () => void;
};

export type BrowserErrorsShow = {
  readonly count: number;
  readonly onShow: () => void;
};

export type BrowserPaneModel = {
  readonly sessionId: SessionId;
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly pins: ReadonlyArray<BrowserTab>;
  readonly projectName: string | null;
  readonly shown: ShownTab | null;
  readonly address: string;
  readonly canOpenOutside: boolean;
  readonly titleOf: (params: TabParams) => string;
  readonly isAsleep: (params: TabParams) => boolean;
  readonly isLiveAsleep: (params: LiveIdParams) => boolean;
  readonly error: string | null;
  readonly notice: string | null;
  readonly isDrafting: boolean;
  readonly isLoading: boolean;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly wakeAttempt: number;
  readonly submit: (params: TextParams) => Promise<boolean>;
  readonly back: () => void;
  readonly forward: () => void;
  readonly reload: () => void;
  readonly reloadFromOrigin: () => void;
  readonly siteHost: string | null;
  readonly siteTrail: ReadonlyArray<string>;
  readonly hasShownView: boolean;
  readonly clearSiteData: () => void;
  readonly stop: () => void;
  readonly select: (params: TabParams) => void;
  readonly close: (params: TabParams) => void;
  readonly reopen: () => void;
  readonly togglePin: () => void;
  readonly startDraft: () => void;
  readonly openOutside: () => void;
  readonly copyAddress: () => void;
  readonly duplicate: () => void;
  readonly isPasskeyBlocked: boolean;
  readonly dismissPasskey: () => void;
  readonly find: (params: FindParams) => Promise<boolean>;
  readonly clearFind: () => Promise<void>;
  readonly inspect: () => void;
  readonly devicePreset: DevicePresetId;
  readonly setDevicePreset: (params: DevicePresetParams) => void;
  readonly pageSend: BrowserPageSend;
  readonly showError: (params: ErrorParams) => void;
  readonly shownLiveId: string | null;
};

export type OpenOutcome = 'opened' | 'stale' | 'failed';

export type BrowserPageSession = {
  readonly sessionId: SessionId;
  readonly title: string;
  readonly projectId: ProjectId | null;
  readonly tabs: ReadonlyArray<BrowserTab>;
};

export type BrowserPagePins = {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly pins: ReadonlyArray<BrowserTab>;
};

export type BrowserPageGroup = {
  readonly key: string;
  readonly label: string;
  readonly sessionId: SessionId;
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly isPins: boolean;
};

export type BrowserTarget =
  | { readonly kind: 'web'; readonly url: string }
  | { readonly kind: 'local'; readonly path: string };

export type BrowserAddress =
  | { readonly kind: 'ok'; readonly url: string }
  | { readonly kind: 'local'; readonly path: string }
  | { readonly kind: 'refused'; readonly reason: string };

export type CommandTabRow = {
  readonly kind: 'tab';
  readonly key: string;
  readonly tab: BrowserTab;
  readonly sessionId: SessionId;
  readonly title: string;
  readonly address: string;
  readonly place: string | null;
  readonly isPin: boolean;
  readonly isHere: boolean;
};

type CommandAddressRow<Kind extends 'open' | 'outside'> = {
  readonly kind: Kind;
  readonly key: string;
  readonly url: string;
  readonly label: string;
};

export type CommandRow =
  | CommandAddressRow<'open'>
  | CommandAddressRow<'outside'>
  | CommandTabRow
  | {
      readonly kind: 'visit';
      readonly key: string;
      readonly url: string;
      readonly title: string;
      readonly address: string;
    };

export type CommandGroup = {
  readonly key: 'open' | 'tabs' | 'visited';
  readonly label: string;
  readonly rows: ReadonlyArray<CommandRow>;
};

export type CommandRows = {
  readonly groups: ReadonlyArray<CommandGroup>;
  readonly hasNoMatch: boolean;
};
