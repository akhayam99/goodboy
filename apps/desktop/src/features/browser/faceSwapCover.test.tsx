// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FACE_SWAP_ATTRIBUTE, SPLIT_DRAG_ATTRIBUTE } from '@goodboy/ui';
import { nextSessionId } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../store/storyHarness';
import type { BrowserTab } from '../../store/slices/browser/types';
import { BrowserCover } from './components/BrowserPane/BrowserCover';
import { createNativePlacement } from './createNativePlacement';
import { createOverlayWatch } from './createOverlayWatch';
import { viewBoundsOf } from './viewBoundsOf';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

const SESSION_ID = nextSessionId();
const TAB: BrowserTab = {
  id: 'tab-ledger',
  sessionId: SESSION_ID,
  projectId: null,
  url: 'http://localhost:4010/ledger',
  title: 'Ledger',
  position: 0,
  createdAt: 1,
  updatedAt: 1,
};
const FRAMES = 17;
const SLIDE_PX = 16;
const REST = { x: 720, y: 96, width: 720, height: 720 };

type CommandParams = {
  readonly command: string;
};

type SlideParams = {
  readonly view: HTMLElement;
  readonly shift: number;
};

type SwapParams = {
  readonly isShownBefore: boolean;
};

let store: StoryStore;

const countOf = ({ command }: CommandParams): number =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command).length;

const lastPlace = (): unknown =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'browser_tab_place').at(-1)?.[1];

const settle = () => new Promise((resolve) => setImmediate(resolve));

const slideTo = ({ view, shift }: SlideParams): void => {
  Object.defineProperty(view, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(REST.x + shift, REST.y, REST.width, REST.height),
  });
};

const swap = async ({ isShownBefore }: SwapParams) => {
  const view = document.createElement('div');
  document.body.append(view);
  const overlays = createOverlayWatch();
  const placement = createNativePlacement({ sessionId: SESSION_ID, onError: () => undefined });
  const frame = async (): Promise<void> => {
    const bounds = viewBoundsOf({ view, overlays, zoom: 1 });
    placement.want({ view: bounds === null ? null : { tab: TAB, bounds } });
    await settle();
  };
  slideTo({ view, shift: 0 });
  if (isShownBefore) {
    await frame();
  }
  storySpies.tauriInvoke.mockClear();
  document.body.setAttribute(FACE_SWAP_ATTRIBUTE, 'desk');
  for (let index = 0; index < FRAMES; index += 1) {
    slideTo({ view, shift: SLIDE_PX - index });
    await frame();
  }
  document.body.removeAttribute(FACE_SWAP_ATTRIBUTE);
  slideTo({ view, shift: 0 });
  await frame();
  const calls = {
    place: countOf({ command: 'browser_tab_place' }),
    show: countOf({ command: 'browser_tab_show' }),
    hide: countOf({ command: 'browser_tab_hide' }),
  };
  placement.stop();
  overlays.stop();
  await settle();
  return calls;
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    browserSessionTabs: { [SESSION_ID]: [TAB] },
    browserLiveTabs: { [SESSION_ID]: { [TAB.id]: 'live-ledger' } },
  });
  stubStoryInvoke({
    browser_tab_place: null,
    browser_tab_show: null,
    browser_tab_hide: null,
  });
});

afterEach(() => {
  cleanup();
  document.body.removeAttribute(FACE_SWAP_ATTRIBUTE);
  document.body.removeAttribute(SPLIT_DRAG_ATTRIBUTE);
  document.body.replaceChildren();
});

describe('a face swap over a native page', () => {
  it('covers the page for the whole move, ahead of a drag', () => {
    const view = document.createElement('div');
    slideTo({ view, shift: 0 });
    document.body.append(view);
    const watch = createOverlayWatch();

    document.body.setAttribute(FACE_SWAP_ATTRIBUTE, 'desk');
    document.body.setAttribute(SPLIT_DRAG_ATTRIBUTE, 'x');
    expect(watch.coverOf({ view, rect: view.getBoundingClientRect() })).toBe('swap');
    document.body.removeAttribute(FACE_SWAP_ATTRIBUTE);
    document.body.removeAttribute(SPLIT_DRAG_ATTRIBUTE);
    expect(watch.coverOf({ view, rect: view.getBoundingClientRect() })).toBeNull();
    watch.stop();
  });

  it('places a page that arrives with the desk once, at the end of the move', async () => {
    const calls = await swap({ isShownBefore: false });

    expect(calls).toEqual({ place: 1, show: 1, hide: 0 });
    expect(lastPlace()).toEqual({
      args: { tabId: 'live-ledger', bounds: REST },
    });
  });

  it('hides a page already shown once, and places it once when the move ends', async () => {
    const calls = await swap({ isShownBefore: true });

    expect(calls).toEqual({ place: 1, show: 1, hide: 1 });
  });

  it('draws the page title on the cover, with no reason line for a move', () => {
    render(<BrowserCover tab={TAB} title="Ledger" reason="swap" />);

    const cover = screen.getByRole('status');
    expect(cover.getAttribute('data-browser-cover')).toBe('swap');
    screen.getByText('Ledger');
    screen.getByText('localhost:4010');
    expect(cover.textContent).not.toContain('Hidden');
  });
});
