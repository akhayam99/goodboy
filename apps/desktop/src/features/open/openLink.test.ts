// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStorySession,
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { SETTING_LINKS_OPEN } from '../../shared/lib/linksOpenSetting';
import { requestOpenLink } from '../../shared/lib/requestOpenLink';
import { openLink } from './openLink';
import { openLinkOrThrow } from './openLinkOrThrow';
import { useOpenLinkEvent } from './hooks/useOpenLinkEvent';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const OTHER_SESSION_ID = nextSessionId();
const URL_ON_THE_WEB = 'https://docs.harborline.dev/tax';

type TabOpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};

let store: StoryStore;
let outside: string[];
let tabs: TabOpenArgs['args'][];
let isOutsideRefused: boolean;
const reportError = vi.fn(async () => undefined);

const stubHost = () => {
  stubStoryInvoke({
    open_url: ({ url }: { readonly url: string }) => {
      if (isOutsideRefused) {
        throw new Error('no browser is installed');
      }
      outside = [...outside, url];
      return null;
    },
    browser_tab_rows_list: () => [],
    browser_tab_row_save: null,
    browser_tab_open: ({ args }: TabOpenArgs) => {
      tabs = [...tabs, args];
      return {
        id: `live-${tabs.length}`,
        sessionId: args.sessionId,
        url: args.url,
        title: '',
        state: 'live',
        isShown: false,
        hiddenSinceMs: null,
        openerId: null,
        isPasskeyBlocked: false,
      };
    },
    browser_tab_list: () => [],
    browser_tab_place: null,
    browser_tab_show: null,
    browser_tab_hide: null,
    browser_tab_close: null,
  });
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  outside = [];
  tabs = [];
  isOutsideRefused = false;
  reportError.mockClear();
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    sessions: [
      buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID }),
      buildStorySession({ id: OTHER_SESSION_ID, workspaceId: WORKSPACE_ID }),
    ],
    settings: { [SETTING_LINKS_OPEN]: 'goodboy' },
    reportError,
  });
  stubHost();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('openLink', () => {
  it('opens beside the session that was current at the click', async () => {
    openLink({ url: URL_ON_THE_WEB });
    store.setState({ currentSessionId: OTHER_SESSION_ID });

    await waitFor(() => expect(tabs).toHaveLength(1));
    expect(tabs[0]).toMatchObject({ sessionId: SESSION_ID, url: URL_ON_THE_WEB });
    expect(outside).toEqual([]);
  });

  it('leaves the app when the place is outside, whatever Links says', async () => {
    openLink({ url: URL_ON_THE_WEB, sessionId: null, place: 'outside' });

    await waitFor(() => expect(outside).toEqual([URL_ON_THE_WEB]));
    expect(tabs).toEqual([]);
  });

  it('reports a failed open once, naming the host', async () => {
    isOutsideRefused = true;

    openLink({ url: URL_ON_THE_WEB, sessionId: null, place: 'outside' });

    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't open docs.harborline.dev" }),
    );
  });
});

describe('openLinkOrThrow', () => {
  it('throws the failure and leaves the report to the caller', async () => {
    isOutsideRefused = true;

    await expect(
      openLinkOrThrow({ url: URL_ON_THE_WEB, sessionId: null, place: 'outside' }),
    ).rejects.toThrow('no browser is installed');

    expect(reportError).not.toHaveBeenCalled();
  });
});

describe('requestOpenLink', () => {
  it('reaches the router through the window event', async () => {
    renderHook(() => useOpenLinkEvent());

    requestOpenLink({ url: URL_ON_THE_WEB, sessionId: null, place: 'outside' });

    await waitFor(() => expect(outside).toEqual([URL_ON_THE_WEB]));
  });

  it('carries the modifier of the click to the router', async () => {
    renderHook(() => useOpenLinkEvent());

    requestOpenLink({ url: URL_ON_THE_WEB, event: { metaKey: true, ctrlKey: true } });

    await waitFor(() => expect(outside).toEqual([URL_ON_THE_WEB]));
    expect(tabs).toEqual([]);
  });
});
