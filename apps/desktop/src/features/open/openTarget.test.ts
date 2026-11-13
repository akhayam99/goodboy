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
import type { BrowserTabFacts } from '../browser/types';
import { openTarget } from './openTarget';
import type { OpenTarget } from './types';

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
const PAGE_PATH = '/mirror/rounding-drift/index.html';
const PLAIN = { metaKey: false, ctrlKey: false };
const COMMAND = { metaKey: true, ctrlKey: false };

type OpenLocalArgs = {
  readonly args: { readonly sessionId: SessionId; readonly path: string };
};

const savedCopy = (copy: 'document' | 'wireframe'): OpenTarget => ({
  kind: 'saved-copy',
  copy,
  name: 'Rounding drift',
  workspaceSlug: 'harborline',
  folder: 'rounding-drift',
  file: 'index.html',
});

let store: StoryStore;
let localOpens: OpenLocalArgs['args'][];
let launched: string[];
let isPathRefused: boolean;

const stubHost = () => {
  stubStoryInvoke({
    browser_tab_rows_list: () => [],
    browser_tab_row_save: null,
    browser_tab_open_local: ({ args }: OpenLocalArgs): BrowserTabFacts => {
      localOpens = [...localOpens, args];
      return {
        id: `live-${localOpens.length}`,
        sessionId: args.sessionId,
        url: `gblocal://localhost/token${args.path}`,
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
    artifact_mirror_path: () => {
      if (isPathRefused) {
        throw new Error('the saved copy is not on disk yet');
      }
      return PAGE_PATH;
    },
    artifact_mirror_open: ({ file }: { readonly file: string }) => {
      launched = [...launched, file];
      return null;
    },
  });
};

const pathAsks = () =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'artifact_mirror_path').length;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  localOpens = [];
  launched = [];
  isPathRefused = false;
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Macintosh');
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    sessions: [
      buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID }),
      buildStorySession({ id: OTHER_SESSION_ID, workspaceId: WORKSPACE_ID }),
    ],
  });
  stubHost();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('opening a saved copy', () => {
  it('opens a report in a local tab beside the session and launches nothing outside', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });

    const result = await openTarget({
      target: savedCopy('document'),
      sessionId: SESSION_ID,
      event: PLAIN,
    });

    expect(result).toEqual({ status: 'opened', place: 'beside-session' });
    await waitFor(() => expect(localOpens).toHaveLength(1));
    expect(localOpens[0]).toMatchObject({ sessionId: SESSION_ID, path: PAGE_PATH });
    expect(launched).toEqual([]);
  });

  it('opens outside on a command click, whatever the setting says', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });

    const result = await openTarget({
      target: savedCopy('document'),
      sessionId: SESSION_ID,
      event: COMMAND,
    });

    expect(result).toEqual({ status: 'opened', place: 'your-browser' });
    expect(launched).toEqual(['index.html']);
    expect(localOpens).toEqual([]);
    expect(pathAsks()).toBe(0);
  });

  it('opens outside when Links says your browser', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'browser' } });

    await openTarget({ target: savedCopy('document'), sessionId: SESSION_ID, event: PLAIN });

    expect(launched).toEqual(['index.html']);
    expect(localOpens).toEqual([]);
  });

  it('opens outside with no session, even with Links on In Goodboy', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });

    await openTarget({ target: savedCopy('document'), sessionId: null, event: PLAIN });

    expect(launched).toEqual(['index.html']);
    expect(localOpens).toEqual([]);
  });

  it('keeps a wireframe outside whatever Links says', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });

    const result = await openTarget({
      target: savedCopy('wireframe'),
      sessionId: SESSION_ID,
      event: PLAIN,
    });

    expect(result).toEqual({ status: 'opened', place: 'your-browser' });
    expect(launched).toEqual(['index.html']);
    expect(localOpens).toEqual([]);
    expect(pathAsks()).toBe(0);
  });

  it('keeps the page and returns the reason when the path is refused', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });
    const reportError = vi.fn(async () => undefined);
    store.setState({ reportError });
    isPathRefused = true;

    const result = await openTarget({
      target: savedCopy('document'),
      sessionId: SESSION_ID,
      event: PLAIN,
    });

    expect(result).toMatchObject({ status: 'failed' });
    expect(result.status === 'failed' ? result.reason : '').toContain('not on disk yet');
    expect(localOpens).toEqual([]);
    expect(launched).toEqual([]);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't open Rounding drift", sessionId: SESSION_ID }),
    );
  });

  it('leaves the report to the caller when it asks to', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });
    const reportError = vi.fn(async () => undefined);
    store.setState({ reportError });
    isPathRefused = true;

    const result = await openTarget({
      target: savedCopy('document'),
      sessionId: SESSION_ID,
      event: PLAIN,
      shouldReport: false,
    });

    expect(result.status).toBe('failed');
    expect(reportError).not.toHaveBeenCalled();
  });

  it('lands in the session of the click when you leave it before the open resolves', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });

    const pending = openTarget({
      target: savedCopy('document'),
      sessionId: SESSION_ID,
      event: PLAIN,
    });
    store.setState({ currentSessionId: OTHER_SESSION_ID });
    await pending;

    await waitFor(() => expect(localOpens).toHaveLength(1));
    expect(localOpens[0]?.sessionId).toBe(SESSION_ID);
  });
});

describe('opening a web address', () => {
  it('still opens beside the session by default', async () => {
    stubStoryInvoke({
      browser_tab_rows_list: () => [],
      browser_tab_row_save: null,
      browser_tab_open: ({ args }: { readonly args: { readonly sessionId: string } }) => ({
        id: 'live-web',
        sessionId: args.sessionId,
        url: 'https://docs.harborline.dev/tax',
        title: '',
        state: 'live',
        isShown: false,
        hiddenSinceMs: null,
        openerId: null,
        isPasskeyBlocked: false,
      }),
      browser_tab_list: () => [],
      browser_tab_place: null,
      browser_tab_show: null,
      browser_tab_hide: null,
      browser_tab_close: null,
    });

    const result = await openTarget({
      target: { kind: 'web', url: 'https://docs.harborline.dev/tax' },
      sessionId: SESSION_ID,
      event: PLAIN,
    });

    expect(result).toEqual({ status: 'opened', place: 'beside-session' });
  });
});
