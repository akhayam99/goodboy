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

type Axis = 'x' | 'y';

type SizeParams = {
  readonly view: HTMLElement;
  readonly axis: Axis;
  readonly shrink: number;
};

type DragParams = {
  readonly isCovered: boolean;
  readonly axis: Axis;
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

const rectOf = ({ axis, shrink }: Omit<SizeParams, 'view'>): DOMRect =>
  axis === 'x'
    ? new DOMRect(START.x + shrink, START.y, START.width - shrink, START.height)
    : new DOMRect(START.x, START.y + shrink, START.width, START.height - shrink);

const giveSize = ({ view, axis, shrink }: SizeParams): void => {
  Object.defineProperty(view, 'getBoundingClientRect', {
    configurable: true,
    value: () => rectOf({ axis, shrink }),
  });
};

const drag = async ({ isCovered, axis }: DragParams) => {
  const view = placedView();
  const overlays = createOverlayWatch();
  const placement = createNativePlacement({ sessionId: SESSION_ID, onError: () => undefined });
  const frame = async (): Promise<void> => {
    const bounds = viewBoundsOf({ view, overlays, zoom: 1 });
    placement.want({ view: bounds === null ? null : { tab: TAB, bounds } });
    await settle();
  };
  giveSize({ view, axis, shrink: 0 });
  await frame();
  storySpies.tauriInvoke.mockClear();
  if (isCovered) {
    document.body.setAttribute(SPLIT_DRAG_ATTRIBUTE, axis);
  }
  for (let index = 1; index <= FRAMES; index += 1) {
    giveSize({ view, axis, shrink: index * STEP_PX });
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

const releaseOf = ({ axis }: Pick<DragParams, 'axis'>) => {
  const rect = rectOf({ axis, shrink: FRAMES * STEP_PX });
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
};

describe('a split drag over a native page', () => {
  it('places the page on every frame of the drag when nothing covers it', async () => {
    const calls = await drag({ isCovered: false, axis: 'x' });

    expect(calls).toEqual({ place: FRAMES, show: 0, hide: 0 });
  });

  it.each<Axis>(['x', 'y'])(
    'hides the page once under the %s drag cover and places it once at the release',
    async (axis) => {
      const calls = await drag({ isCovered: true, axis });

      expect(calls).toEqual({ place: 1, show: 1, hide: 1 });
      expect(lastPlace()).toEqual({
        args: { tabId: 'live-ledger', bounds: releaseOf({ axis }) },
      });
    },
  );
});
