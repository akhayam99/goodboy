// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPLIT_DRAG_ATTRIBUTE } from '@goodboy/ui';
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
  url: 'http://localhost:5173/ledger',
  title: 'Ledger',
  position: 0,
  createdAt: 1,
  updatedAt: 1,
};
const FRAMES = 30;
const STEP_PX = 10;
const START = { x: 720, y: 96, width: 720, height: 720 };

type CommandParams = {
  readonly command: string;
};

type WidthParams = {
  readonly view: HTMLElement;
  readonly width: number;
};

type DragParams = {
  readonly isCovered: boolean;
};

let store: StoryStore;

const countOf = ({ command }: CommandParams): number =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command).length;

const lastPlace = (): unknown =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'browser_tab_place').at(-1)?.[1];

const settle = () => new Promise((resolve) => setImmediate(resolve));

const placedView = (): HTMLElement => {
  const view = document.createElement('div');
  document.body.append(view);
  return view;
};

const giveWidth = ({ view, width }: WidthParams): void => {
  Object.defineProperty(view, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(START.x + START.width - width, START.y, width, START.height),
  });
};

const drag = async ({ isCovered }: DragParams) => {
  const view = placedView();
  const overlays = createOverlayWatch();
  const placement = createNativePlacement({ sessionId: SESSION_ID, onError: () => undefined });
  const frame = async (): Promise<void> => {
    const bounds = viewBoundsOf({ view, overlays, zoom: 1 });
    placement.want({ view: bounds === null ? null : { tab: TAB, bounds } });
    await settle();
  };
  giveWidth({ view, width: START.width });
  await frame();
  storySpies.tauriInvoke.mockClear();
  if (isCovered) {
    document.body.setAttribute(SPLIT_DRAG_ATTRIBUTE, 'x');
  }
  for (let index = 1; index <= FRAMES; index += 1) {
    giveWidth({ view, width: START.width - index * STEP_PX });
    await frame();
  }
  document.body.removeAttribute(SPLIT_DRAG_ATTRIBUTE);
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
  document.body.removeAttribute(SPLIT_DRAG_ATTRIBUTE);
  document.body.replaceChildren();
});

describe('a split drag over a native page', () => {
  it('places the page on every frame of the drag when nothing covers it', async () => {
    const calls = await drag({ isCovered: false });

    expect(calls).toEqual({ place: FRAMES, show: 0, hide: 0 });
  });

  it('hides the page once under the drag cover and places it once at the release', async () => {
    const calls = await drag({ isCovered: true });

    expect(calls).toEqual({ place: 1, show: 1, hide: 1 });
    expect(lastPlace()).toEqual({
      args: {
        tabId: 'live-ledger',
        bounds: {
          x: START.x + FRAMES * STEP_PX,
          y: START.y,
          width: START.width - FRAMES * STEP_PX,
          height: START.height,
        },
      },
    });
  });
});
