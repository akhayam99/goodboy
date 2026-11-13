import type { SessionId, WorkspaceId } from '@goodboy/types';
import { invokeCommand } from '../../shared/lib/invokeCommand';
import type { DevicePresetId } from '../../store/slices/browser/types';
import type {
  BrowserBounds,
  BrowserConsoleRead,
  BrowserFindOutcome,
  BrowserHistoryState,
  BrowserPageText,
  BrowserTabFacts,
  BrowserTabFavicon,
} from './types';

type OpenParams = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly url: string;
  readonly bounds: BrowserBounds;
  readonly isShown: boolean;
};

type OpenLocalParams = Omit<OpenParams, 'url'> & {
  readonly path: string;
};

type TabParams = {
  readonly tabId: string;
};

type NavigateLocalParams = TabParams & {
  readonly path: string;
};

type PlaceParams = TabParams & {
  readonly bounds: BrowserBounds;
};

type NavigateParams = TabParams & {
  readonly url: string;
};

type UserAgentParams = TabParams & {
  readonly preset: DevicePresetId;
};

type FindParams = TabParams & {
  readonly needle: string;
  readonly isBackwards: boolean;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

type PageTextParams = TabParams &
  SessionParams & {
    readonly host: string;
  };

type ConsoleReadParams = TabParams &
  SessionParams & {
    readonly doc: string | null;
    readonly after: number;
  };

type PageKeysParams = {
  readonly combos: ReadonlyArray<string>;
};

export const browserHost = {
  open: ({ sessionId, workspaceId, url, bounds, isShown }: OpenParams) =>
    invokeCommand<BrowserTabFacts>('browser_tab_open', {
      args: { sessionId, workspaceId, url, bounds, isShown },
    }),
  openLocal: ({ sessionId, workspaceId, path, bounds, isShown }: OpenLocalParams) =>
    invokeCommand<BrowserTabFacts>('browser_tab_open_local', {
      args: { sessionId, workspaceId, path, bounds, isShown },
    }),
  place: ({ tabId, bounds }: PlaceParams) =>
    invokeCommand<null>('browser_tab_place', { args: { tabId, bounds } }),
  show: ({ tabId }: TabParams) =>
    invokeCommand<BrowserTabFacts>('browser_tab_show', { args: { tabId } }),
  hide: ({ tabId }: TabParams) =>
    invokeCommand<BrowserTabFacts>('browser_tab_hide', { args: { tabId } }),
  navigate: ({ tabId, url }: NavigateParams) =>
    invokeCommand<null>('browser_tab_navigate', { args: { tabId, url } }),
  navigateLocal: ({ tabId, path }: NavigateLocalParams) =>
    invokeCommand<null>('browser_tab_navigate_local', { args: { tabId, path } }),
  reload: ({ tabId }: TabParams) => invokeCommand<null>('browser_tab_reload', { args: { tabId } }),
  stop: ({ tabId }: TabParams) => invokeCommand<null>('browser_tab_stop', { args: { tabId } }),
  find: ({ tabId, needle, isBackwards }: FindParams) =>
    invokeCommand<BrowserFindOutcome>('browser_find', { args: { tabId, needle, isBackwards } }),
  pageText: ({ tabId, sessionId, host }: PageTextParams) =>
    invokeCommand<BrowserPageText>('browser_page_text', { args: { tabId, sessionId, host } }),
  consoleRead: ({ tabId, sessionId, doc, after }: ConsoleReadParams) =>
    invokeCommand<BrowserConsoleRead>('browser_console_read', {
      args: { tabId, sessionId, doc, after },
    }),
  historyState: ({ tabId }: TabParams) =>
    invokeCommand<BrowserHistoryState | null>('browser_history_state', { args: { tabId } }),
  favicon: ({ tabId }: TabParams) =>
    invokeCommand<BrowserTabFavicon | null>('browser_favicon', { args: { tabId } }),
  back: ({ tabId }: TabParams) => invokeCommand<null>('browser_tab_back', { args: { tabId } }),
  forward: ({ tabId }: TabParams) =>
    invokeCommand<null>('browser_tab_forward', { args: { tabId } }),
  dismissPasskey: ({ tabId }: TabParams) =>
    invokeCommand<BrowserTabFacts>('browser_tab_passkey_dismiss', { args: { tabId } }),
  inspectable: ({ tabId }: TabParams) =>
    invokeCommand<null>('browser_tab_inspectable', { args: { tabId } }),
  close: ({ tabId }: TabParams) => invokeCommand<null>('browser_tab_close', { args: { tabId } }),
  userAgent: ({ tabId, preset }: UserAgentParams) =>
    invokeCommand<null>('browser_user_agent', { args: { tabId, preset } }),
  list: ({ sessionId }: SessionParams) =>
    invokeCommand<ReadonlyArray<BrowserTabFacts>>('browser_tab_list', { args: { sessionId } }),
  pageKeys: ({ combos }: PageKeysParams) =>
    invokeCommand<number>('browser_page_keys', { args: { combos } }),
};
