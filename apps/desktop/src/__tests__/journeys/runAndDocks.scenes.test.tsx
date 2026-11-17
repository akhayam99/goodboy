// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({ setZoom: async () => undefined }),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, screen, within } from '@testing-library/react';
import { nextSessionId } from '@goodboy/types/testing';
import { selectDockDrawer } from '../../store/slices/drawer/selectDockDrawer';
import type { BrowserTab } from '../../store/slices/browser/types';
import { appliedZoom } from '../../shared/lib/appliedZoom';
import { storySpies } from '../../store/storyHarness';
import { useNativePlacement } from '../../features/browser/hooks/useNativePlacement';
import { installSceneJourney } from './sceneJourney';

const journey = installSceneJourney();

const dockKind = (): string | null =>
  selectDockDrawer({ state: journey.store().getState() })?.kind ?? null;

const toolsRail = (): HTMLElement => screen.getByRole('toolbar', { name: 'Tools' });

const pressTool = async ({ name }: { readonly name: 'Terminal' | 'Browser' }): Promise<void> => {
  const button = within(toolsRail()).getByRole('button', { name: new RegExp(`^${name}`) });
  await act(async () => {
    button.click();
    await vi.advanceTimersByTimeAsync(400);
  });
};

describe('journey: the run page, its Agents rail and an agent in the centre', () => {
  it('keeps the Agents rail on the left while an agent opens in the centre and the run comes back', async () => {
    await journey.mount({ name: 'run-page-many' });
    const lead = journey.partOf({ selector: '[data-session-lead]' });
    const rail = within(lead).getByRole('complementary', { name: 'Agents' });
    const rows = within(rail).getAllByRole('treeitem');
    const root = journey.view().agentId;
    expect(rows[0]?.getAttribute('aria-selected')).toBe('true');
    const crumbs = journey.crumbsOf();
    expect(crumbs.slice(0, 2)).toEqual(['Overview', 'Runs']);
    expect(journey.partOf({ selector: '[data-session-aside]' }).childElementCount).toBe(0);

    await act(async () => {
      rows[1]?.click();
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(journey.view().agentId).not.toBe(root);
    const railAfter = within(journey.partOf({ selector: '[data-session-lead]' })).getByRole(
      'complementary',
      { name: 'Agents' },
    );
    expect(within(railAfter).getAllByRole('treeitem')[1]?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(journey.crumbsOf()).not.toEqual(crumbs);

    await act(async () => {
      within(railAfter).getAllByRole('treeitem')[0]?.click();
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(journey.view().agentId).toBe(root);
    expect(journey.crumbsOf()).toEqual(crumbs);
  });

  it('opens the Lead page under Overview, Runs, the run and the lead, with its chat', async () => {
    await journey.mount({ name: 'agentlead' });

    const crumbs = journey.crumbsOf();
    expect(crumbs[0]).toBe('Overview');
    expect(crumbs).toHaveLength(4);
    screen.getByRole('button', { name: 'Show hidden crumbs' });
    expect(journey.view().agentId).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'copy message' }).length).toBeGreaterThan(0);
    screen.getByRole('button', { name: /^Back to Round once/ });
  });
});

describe('journey: the board scene draws the tools rail', () => {
  it('lists the five tools on the rail of the board, all closed', async () => {
    await journey.mount({ name: 'ux39-p10-board' });

    screen.getByRole('heading', { name: 'Board' });
    expect(journey.location().place.at).toBe('board');
    const pressed = within(toolsRail())
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-pressed'));
    expect(pressed).toEqual(['false', 'false', 'false', 'false', 'false']);
    expect(dockKind()).toBeNull();
  });
});

describe('journey: the Terminal and Browser docks beside the tools rail', () => {
  it.each([
    ['panel-frame-terminal', 'terminal'],
    ['panel-frame-browser', 'browser'],
  ] as const)(
    'draws the %s dock card first and the tools rail after it, on the window edge',
    async (name, kind) => {
      await journey.mount({ name });

      expect(dockKind()).toBe(kind);
      const container = journey.partOf({ selector: '[data-container="drawer"]' });
      expect(container.children[0]?.hasAttribute('data-drawer-card')).toBe(true);
      expect(container.children[1]?.hasAttribute('data-drawer-edge')).toBe(true);
      expect(container.children[1]?.contains(toolsRail())).toBe(true);
      expect(container.lastElementChild).toBe(container.children[1]);
      expect(
        journey.partOf({ selector: '[aria-label="Side panel"]' }).getAttribute('data-drawer-mode'),
      ).toBe('push');
    },
  );

  it('opens the two docks together from the rail and closes each with its own button', async () => {
    await journey.mount({ name: 'panel-frame-terminal' });
    expect(dockKind()).toBe('terminal');

    await pressTool({ name: 'Browser' });
    expect(
      ['Terminal', 'Browser'].map((name) =>
        within(toolsRail())
          .getByRole('button', { name: new RegExp(`^${name}`) })
          .getAttribute('aria-pressed'),
      ),
    ).toEqual(['true', 'true']);
    expect(
      Array.from(document.querySelectorAll('[data-dock-pane]')).map((pane) =>
        pane.getAttribute('data-dock-pane'),
      ),
    ).toEqual(['terminal', 'browser']);

    await pressTool({ name: 'Terminal' });
    expect(dockKind()).toBe('browser');

    await pressTool({ name: 'Browser' });
    expect(dockKind()).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Tools' })).not.toBeNull();
  });

  it('keeps the detail panel and the dock open together, the panel on the left of the dock', async () => {
    await journey.mount({ name: 'panel-frame-detail-terminal' });

    const side = journey.partOf({ selector: '[aria-label="Side panel"]' });
    const detail = side.querySelector('[data-container="detail"]');
    const drawer = side.querySelector('[data-container="drawer"]');
    expect(detail?.querySelector('[data-detail-card]')).not.toBeNull();
    expect(drawer?.querySelector('[data-drawer-card]')).not.toBeNull();
    expect(
      detail !== null &&
        drawer !== null &&
        (detail.compareDocumentPosition(drawer) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
  });
});

describe('journey: the browser dock under app zoom 125 percent', () => {
  const SESSION_ID = nextSessionId();
  const TAB: BrowserTab = {
    id: 'tab-checkout',
    sessionId: SESSION_ID,
    projectId: null,
    url: 'http://localhost:5173/checkout',
    title: 'Checkout',
    position: 0,
    createdAt: 1,
    updatedAt: 1,
  };

  type RectParams = {
    readonly x: number;
    readonly width: number;
  };

  const placeCalls = (): ReadonlyArray<unknown> =>
    storySpies.tauriInvoke.mock.calls
      .filter(([command]) => command === 'browser_tab_place')
      .map(([, payload]) => payload);

  const dockViewAt = ({ x, width }: RectParams): HTMLDivElement => {
    const view = document.createElement('div');
    Object.defineProperty(view, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(x, 64, width, 400),
    });
    Object.defineProperty(view, 'checkVisibility', { configurable: true, value: () => true });
    document.body.append(view);
    return view;
  };

  it('places the page in window points on the dock card to the right of the tools rail', async () => {
    await journey.mount({ name: 'panel-frame-browser' });
    expect(dockKind()).toBe('browser');
    appliedZoom.write({ factor: 1.25 });
    journey.store().setState({
      browserSessionTabs: { [SESSION_ID]: [TAB] },
      browserLiveTabs: { [SESSION_ID]: { [TAB.id]: 'live-1' } },
    });
    const railRight = 48;
    const view = dockViewAt({ x: 800 + railRight, width: 480 });

    const { unmount } = renderHook(() =>
      useNativePlacement({
        sessionId: SESSION_ID,
        frame: { current: view },
        view: { current: view },
        tab: TAB,
        attempt: 0,
        maxWidth: null,
        onError: () => undefined,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(placeCalls().at(-1)).toEqual({
      args: { tabId: 'live-1', bounds: { x: 1060, y: 80, width: 600, height: 500 } },
    });
    unmount();
    view.remove();
    appliedZoom.write({ factor: 1 });
  });
});
