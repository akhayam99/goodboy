// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../store/storyHarness';
import { SETTING_LINKS_OPEN } from '../../shared/lib/linksOpenSetting';
import type { BrowserTabFacts } from './types';
import { openWebLink } from './openWebLink';

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
const URL = 'http://localhost:5173/';
const PLAIN = { metaKey: false, ctrlKey: false };
const COMMAND = { metaKey: true, ctrlKey: false };

type OpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};
type UrlArgs = { readonly url: string };

let store: StoryStore;
let opened: number;
let outside: string[];

const stubHost = () => {
  stubStoryInvoke({
    browser_tab_rows_list: () => [],
    browser_tab_row_save: null,
    browser_tab_open: ({ args }: OpenArgs): BrowserTabFacts => {
      opened += 1;
      return {
        id: `live-${opened}`,
        sessionId: args.sessionId,
        url: args.url,
        title: '',
        state: 'live',
        isShown: false,
        hiddenSinceMs: null,
        openerId: null,
      };
    },
    browser_tab_list: () => [],
    browser_tab_place: null,
    browser_tab_show: null,
    browser_tab_hide: null,
    browser_tab_close: null,
    open_url: ({ url }: UrlArgs) => {
      outside = [...outside, url];
      return null;
    },
  });
};

const tabOpens = () =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'browser_tab_open').length;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  opened = 0;
  outside = [];
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Macintosh');
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
  });
  stubHost();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the one rule for a plain web link', () => {
  it('opens beside the session by default', async () => {
    await openWebLink({ sessionId: SESSION_ID, url: URL, event: PLAIN });

    await waitFor(() => expect(tabOpens()).toBe(1));
    expect(outside).toEqual([]);
  });

  it('opens your browser on a command click, whatever the setting says', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });

    await openWebLink({ sessionId: SESSION_ID, url: URL, event: COMMAND });

    expect(outside).toEqual([URL]);
    expect(tabOpens()).toBe(0);
  });

  it('opens your browser when the setting says so, with a session', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'browser' } });

    await openWebLink({ sessionId: SESSION_ID, url: URL, event: PLAIN });

    expect(outside).toEqual([URL]);
    expect(tabOpens()).toBe(0);
  });

  it('opens your browser for a terminal with no session, setting or not', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });

    await openWebLink({ sessionId: null, url: URL, event: PLAIN });

    expect(outside).toEqual([URL]);
    expect(tabOpens()).toBe(0);
  });

  it('reads the setting once at the click, so a later change leaves it alone', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'browser' } });
    const pending = openWebLink({ sessionId: SESSION_ID, url: URL, event: PLAIN });
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });

    await pending;

    expect(outside).toEqual([URL]);
  });
});
