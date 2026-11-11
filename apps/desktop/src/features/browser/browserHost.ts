import type { SessionId, WorkspaceId } from '@goodboy/types';
import { invokeCommand } from '../../shared/lib/invokeCommand';
import type {
  BrowserBounds,
  BrowserFindOutcome,
  BrowserHistoryState,
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

type TabParams = {
  readonly tabId: string;
};

type PlaceParams = TabParams & {
  readonly bounds: BrowserBounds;
};

type NavigateParams = TabParams & {
  readonly url: string;
};

type FindParams = TabParams & {
  readonly needle: string;
  readonly isBackwards: boolean;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

type PageKeysParams = {
  readonly combos: ReadonlyArray<string>;
};

export const browserHost = {
  open: ({ sessionId, workspaceId, url, bounds, isShown }: OpenParams) =>
    invokeCommand<BrowserTabFacts>('browser_tab_open', {
      args: { sessionId, workspaceId, url, bounds, isShown },
    }),
  place: ({ tabId, bounds }: PlaceParams) =>
    invokeCommand<null>('browser_tab_place', { args: { tabId, bounds } }),
  show: ({ tabId }: TabParams) =>
    invokeCommand<BrowserTabFacts>('browser_tab_show', { args: { tabId } }),
  hide: ({ tabId }: TabParams) =>
    invokeCommand<BrowserTabFacts>('browser_tab_hide', { args: { tabId } }),
  navigate: ({ tabId, url }: NavigateParams) =>
    invokeCommand<null>('browser_tab_navigate', { args: { tabId, url } }),
  reload: ({ tabId }: TabParams) => invokeCommand<null>('browser_tab_reload', { args: { tabId } }),
  stop: ({ tabId }: TabParams) => invokeCommand<null>('browser_tab_stop', { args: { tabId } }),
  find: ({ tabId, needle, isBackwards }: FindParams) =>
    invokeCommand<BrowserFindOutcome>('browser_find', { args: { tabId, needle, isBackwards } }),
  historyState: ({ tabId }: TabParams) =>
    invokeCommand<BrowserHistoryState | null>('browser_history_state', { args: { tabId } }),
  favicon: ({ tabId }: TabParams) =>
    invokeCommand<BrowserTabFavicon | null>('browser_favicon', { args: { tabId } }),
  back: ({ tabId }: TabParams) => invokeCommand<null>('browser_tab_back', { args: { tabId } }),
  forward: ({ tabId }: TabParams) =>
    invokeCommand<null>('browser_tab_forward', { args: { tabId } }),
  close: ({ tabId }: TabParams) => invokeCommand<null>('browser_tab_close', { args: { tabId } }),
  list: ({ sessionId }: SessionParams) =>
    invokeCommand<ReadonlyArray<BrowserTabFacts>>('browser_tab_list', { args: { sessionId } }),
  pageKeys: ({ combos }: PageKeysParams) =>
    invokeCommand<number>('browser_page_keys', { args: { combos } }),
};
