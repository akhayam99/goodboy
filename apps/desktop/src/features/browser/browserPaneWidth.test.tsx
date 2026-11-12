// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DRAWER_INSET, DrawerColumn, READER_DRAWER_STORAGE_KEY } from '@goodboy/ui';
import { aSession, nextSessionId } from '@goodboy/types/testing';
import { importStore, resetStoryStore, type StoryStore } from '../../store/storyHarness';
import { selectDrawerSizing } from '../../store/slices/drawer/selectDrawerSizing';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

type DriveParams = { readonly initial: number };

const BROWSER_DRAWER_STORAGE_KEY = 'goodboy:browser-drawer-width:v1';
const BROWSER_DRAWER_DEFAULT = 720;
const SESSION_ID = nextSessionId();

let store: StoryStore;

const driveColumnWidth = ({ initial }: DriveParams) => {
  const callbacks: ObserverCallback[] = [];
  class DrivenObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
      callbacks.push(callback);
    }
    observe() {
      this.callback([{ contentRect: { width: initial } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', DrivenObserver);
  return (width: number) =>
    act(() => {
      callbacks.forEach((callback) => callback([{ contentRect: { width } }]));
    });
};

const renderBrowserPane = () => {
  store.getState().openDrawer({ kind: 'browser', sessionId: SESSION_ID, payload: null });
  return render(
    <DrawerColumn
      main={<div>session</div>}
      drawer={<div>Harborline docs</div>}
      sizing={selectDrawerSizing(store.getState())}
      ariaLabel="Browser"
      resizeLabel="Resize browser"
    />,
  );
};

const pane = () => screen.getByRole('complementary', { name: 'Browser' });
const handle = () => screen.getByRole('separator', { name: 'Resize browser' });
const trackOf = (width: number): string => `${width + DRAWER_INSET * 2}px`;

beforeAll(async () => {
  store = await importStore();
});

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  store.setState({ sessions: [aSession({ id: SESSION_ID })], currentSessionId: SESSION_ID });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the browser pane width', () => {
  it('opens in the browser tier, with its own saved width', () => {
    driveColumnWidth({ initial: 2600 });
    renderBrowserPane();

    expect(selectDrawerSizing(store.getState())).toBe('browser');
    expect(pane().getAttribute('data-drawer-sizing')).toBe('browser');
    expect(pane().style.width).toBe(trackOf(BROWSER_DRAWER_DEFAULT));
  });

  it('takes a drag past 1000 on a wide window', () => {
    driveColumnWidth({ initial: 2600 });
    renderBrowserPane();

    fireEvent.mouseDown(handle(), { button: 0, clientX: 1500 });
    fireEvent.mouseMove(window, { clientX: 900 });
    fireEvent.mouseUp(window);

    expect(pane().getAttribute('data-drawer-mode')).toBe('push');
    expect(pane().style.width).toBe(trackOf(1320));
    expect(localStorage.getItem(BROWSER_DRAWER_STORAGE_KEY)).toBe('1320');
    expect(localStorage.getItem(READER_DRAWER_STORAGE_KEY)).toBeNull();
  });

  it('clamps a drag on a narrow window to what leaves the session column its 560', () => {
    driveColumnWidth({ initial: 1500 });
    renderBrowserPane();

    fireEvent.mouseDown(handle(), { button: 0, clientX: 1500 });
    fireEvent.mouseMove(window, { clientX: 0 });
    fireEvent.mouseUp(window);

    expect(pane().getAttribute('data-drawer-mode')).toBe('push');
    expect(pane().style.width).toBe(trackOf(876));
    expect(localStorage.getItem(BROWSER_DRAWER_STORAGE_KEY)).toBe('876');
  });

  it('restores a saved width after a window resize, clamped to the room it has', () => {
    localStorage.setItem(BROWSER_DRAWER_STORAGE_KEY, '1400');
    const resizeTo = driveColumnWidth({ initial: 2600 });
    renderBrowserPane();
    expect(pane().style.width).toBe(trackOf(1400));

    resizeTo(1700);

    expect(pane().getAttribute('data-drawer-mode')).toBe('push');
    expect(pane().style.width).toBe(trackOf(1076));
    expect(localStorage.getItem(BROWSER_DRAWER_STORAGE_KEY)).toBe('1400');

    resizeTo(2600);

    expect(pane().style.width).toBe(trackOf(1400));
  });

  it('lies over the page once even 720 does not fit', () => {
    localStorage.setItem(BROWSER_DRAWER_STORAGE_KEY, '1400');
    driveColumnWidth({ initial: 1200 });
    renderBrowserPane();

    expect(pane().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(pane().style.width).toBe(`${1184 + DRAWER_INSET}px`);
  });
});
