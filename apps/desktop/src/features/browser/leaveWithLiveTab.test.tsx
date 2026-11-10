// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../test/sceneInvoke';
import { U39_P10_SCENES } from '../../app/components/MockScene/scenes/u39/p10-right-dock';

const LIVE_ID = 'ux39-live-harborline-checkout';
const VIEW_RECT = { x: 760, y: 96, width: 440, height: 680 };

type CommandParams = {
  readonly command: string;
};

type ArgParams = {
  readonly payload: unknown;
  readonly key: string;
};

type SelectorParams = {
  readonly selector: string;
};

type ViewCall = {
  readonly at: number;
  readonly bounds: unknown;
};

let useAppStore: StoryStore;

const argOf = ({ payload, key }: ArgParams): unknown => {
  const args: unknown =
    typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'args') : null;
  return typeof args === 'object' && args !== null ? Reflect.get(args, key) : null;
};

const callsOf = ({ command }: CommandParams): ReadonlyArray<ViewCall> =>
  storySpies.tauriInvoke.mock.calls.flatMap(([name, payload], at) =>
    name === command && argOf({ payload, key: 'tabId' }) === LIVE_ID
      ? [{ at, bounds: argOf({ payload, key: 'bounds' }) }]
      : [],
  );

const lastAt = ({ command }: CommandParams): number => callsOf({ command }).at(-1)?.at ?? -1;

const found = ({ selector }: SelectorParams): HTMLElement => {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
};

const shownDockView = (): HTMLElement | null => {
  const view = document.querySelector<HTMLElement>('[data-browser-view]');
  const dock = view?.closest('aside[data-drawer-mode]') ?? null;
  if (view === null || dock === null) {
    return null;
  }
  return dock.hasAttribute('data-drawer-parked') || dock.hasAttribute('inert') ? null : view;
};

const expectNeverPaintedOutsideTheDock = (): void => {
  const isHidden =
    lastAt({ command: 'browser_tab_hide' }) > lastAt({ command: 'browser_tab_show' });
  if (isHidden) {
    return;
  }
  expect(shownDockView()).not.toBeNull();
  expect(callsOf({ command: 'browser_tab_place' }).at(-1)?.bounds).toEqual(VIEW_RECT);
};

const WAIT = { timeout: 8_000 };

const mountBrowserBesideSession = async (): Promise<void> => {
  const Scene = U39_P10_SCENES['ux39-p11-browser-session'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await waitFor(
    () => expect(callsOf({ command: 'browser_tab_show' }).length).toBeGreaterThan(0),
    WAIT,
  );
  await waitFor(() => expect(shownDockView()).not.toBeNull(), WAIT);
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.hasAttribute('data-browser-view')) {
      return new DOMRect(VIEW_RECT.x, VIEW_RECT.y, VIEW_RECT.width, VIEW_RECT.height);
    }
    return new DOMRect(0, 0, 0, 0);
  });
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
});

describe('a live Browser tab when you leave the session', () => {
  it('stays inside the visible dock or is hidden when Chat opens from the column', async () => {
    await mountBrowserBesideSession();
    fireEvent.click(found({ selector: '[data-side-column] [data-column-door="chat"]' }));
    await waitFor(() => expect(useAppStore.getState().appStudio?.kind).toBe('chat'), WAIT);

    await waitFor(() => expectNeverPaintedOutsideTheDock(), WAIT);
  });

  it('stays inside the visible dock or is hidden when Settings opens', async () => {
    await mountBrowserBesideSession();
    const column = found({ selector: '[data-side-column]' });

    fireEvent.click(within(column).getByRole('button', { name: 'Settings' }));
    await waitFor(() => expect(useAppStore.getState().appStudio?.kind).toBe('settings'), WAIT);

    await waitFor(() => expectNeverPaintedOutsideTheDock(), WAIT);
  });

  it('is hidden once the dock closes', async () => {
    await mountBrowserBesideSession();

    act(() => useAppStore.getState().closeDrawer());

    await waitFor(
      () =>
        expect(lastAt({ command: 'browser_tab_hide' })).toBeGreaterThan(
          lastAt({ command: 'browser_tab_show' }),
        ),
      WAIT,
    );
    expect(screen.queryByRole('region', { name: /^Page:/ })).toBeNull();
  });
});
