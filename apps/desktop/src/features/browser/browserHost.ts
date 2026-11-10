import type { SessionId, WorkspaceId } from '@goodboy/types';
import { invokeCommand } from '../../shared/lib/invokeCommand';
import type { BrowserBounds, BrowserTabFacts } from './types';

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

type SessionParams = {
  readonly sessionId: SessionId;
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
  back: ({ tabId }: TabParams) => invokeCommand<null>('browser_tab_back', { args: { tabId } }),
  forward: ({ tabId }: TabParams) =>
    invokeCommand<null>('browser_tab_forward', { args: { tabId } }),
  close: ({ tabId }: TabParams) => invokeCommand<null>('browser_tab_close', { args: { tabId } }),
  list: ({ sessionId }: SessionParams) =>
    invokeCommand<ReadonlyArray<BrowserTabFacts>>('browser_tab_list', { args: { sessionId } }),
};
