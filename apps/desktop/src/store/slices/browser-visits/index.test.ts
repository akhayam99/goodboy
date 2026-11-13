import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';
import type { BrowserVisit } from './types';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const SESSION_ID = nextSessionId();
const CONFIRM: BrowserVisit = {
  url: 'http://localhost:5173/checkout/confirm',
  title: 'Confirm order',
  visitedAt: 3,
};
const TAX: BrowserVisit = { url: 'http://localhost:5173/tax', title: 'Tax rates', visitedAt: 2 };

let useAppStore: StoryStore;

const visitUrls = () =>
  (useAppStore.getState().browserVisits[SESSION_ID] ?? []).map((visit) => visit.url);

const storedErrors = () =>
  useAppStore
    .getState()
    .notifications.filter((notification) => notification.kind === 'error')
    .map((notification) => notification.title);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('the browser visits slice', () => {
  it('loads the visits of the session it names', async () => {
    stubStoryInvoke({ browser_visits_list: [CONFIRM, TAX] });

    await useAppStore.getState().loadBrowserVisits({ sessionId: SESSION_ID });

    expect(visitUrls()).toEqual([CONFIRM.url, TAX.url]);
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('browser_visits_list', {
      args: { sessionId: SESSION_ID },
    });
  });

  it('drops an older load that answers after a newer one', async () => {
    let releaseOlder: (visits: BrowserVisit[]) => void = () => undefined;
    let isFirst = true;
    stubStoryInvoke({
      browser_visits_list: () => {
        if (isFirst) {
          isFirst = false;
          return new Promise<BrowserVisit[]>((resolve) => {
            releaseOlder = resolve;
          });
        }
        return [CONFIRM];
      },
    });

    const older = useAppStore.getState().loadBrowserVisits({ sessionId: SESSION_ID });
    await useAppStore.getState().loadBrowserVisits({ sessionId: SESSION_ID });
    releaseOlder([TAX]);
    await older;

    expect(visitUrls()).toEqual([CONFIRM.url]);
  });

  it('keeps the visits it had and reports once when a load fails', async () => {
    stubStoryInvoke({ browser_visits_list: [TAX] });
    await useAppStore.getState().loadBrowserVisits({ sessionId: SESSION_ID });
    stubStoryInvoke({
      browser_visits_list: () => {
        throw { kind: 'failed', message: 'visits-failed' };
      },
    });

    await useAppStore.getState().loadBrowserVisits({ sessionId: SESSION_ID });

    expect(visitUrls()).toEqual([TAX.url]);
    expect(storedErrors()).toEqual(["Couldn't load the visited pages"]);
  });

  it('leaves the state untouched when the visits did not change', async () => {
    stubStoryInvoke({ browser_visits_list: [CONFIRM] });
    await useAppStore.getState().loadBrowserVisits({ sessionId: SESSION_ID });
    const before = useAppStore.getState().browserVisits;

    await useAppStore.getState().loadBrowserVisits({ sessionId: SESSION_ID });

    expect(useAppStore.getState().browserVisits).toBe(before);
  });
});
