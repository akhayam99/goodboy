// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../../store/storyHarness';
import { MOCK_SCENES } from '../../..';
import { U37_ARTIFACT_REPORT_SCENES } from './artifact-report';

const SCROLL_PX = 400;
const PINNED_PX = 104;
const SCENE_WAIT = { timeout: 5000 };

let observers: FakeResizeObservers;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  observers = installFakeResizeObserver();
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
});

type ClosestParams = {
  readonly node: Element;
  readonly selector: string;
};

const closest = ({ node, selector }: ClosestParams): HTMLElement => {
  const match = node.closest<HTMLElement>(selector);
  if (match === null) {
    throw new Error(`no ${selector}`);
  }
  return match;
};

const reportScroller = (): HTMLElement | null =>
  document
    .querySelector('[data-testid="artifact-shell"]')
    ?.closest<HTMLElement>('[data-page-scroller]') ?? null;

describe('u37 artifact report scrolled', () => {
  it('registers both themes', () => {
    Object.keys(U37_ARTIFACT_REPORT_SCENES).forEach((id) => {
      expect(MOCK_SCENES[id]).toBeDefined();
    });
  });

  it.each(Object.keys(U37_ARTIFACT_REPORT_SCENES))(
    'scrolls %s under one pinned zone padded by its height',
    async (id) => {
      const Scene = MOCK_SCENES[id];
      if (Scene === undefined) {
        throw new Error(`no scene ${id}`);
      }
      render(<Scene />);

      const back = await screen.findByRole('button', { name: 'Back to artifacts' }, SCENE_WAIT);
      const header = await screen.findByTestId('artifact-shell-header', {}, SCENE_WAIT);
      const zone = closest({ node: header, selector: '[data-slot="reveal-pinned"]' });
      expect(zone.contains(back)).toBe(true);
      const region = closest({ node: zone, selector: '[data-slot="reveal-region"]' });
      expect(region.querySelector('[data-slot="reveal-header"]')?.childElementCount).toBe(0);

      await waitFor(() => expect(reportScroller()?.scrollTop).toBe(SCROLL_PX), SCENE_WAIT);

      const overlay = closest({ node: zone, selector: '[data-slot="reveal-overlay"]' });
      Object.defineProperty(overlay, 'offsetHeight', { configurable: true, value: PINNED_PX });
      observers.resizeAll();

      expect(region.style.getPropertyValue('--reveal-inset')).toBe(`${PINNED_PX}px`);
      expect(region.style.getPropertyValue('--reveal-pad')).toBe('0px');
      const scroller = reportScroller();
      expect(scroller === null ? false : region.contains(scroller)).toBe(true);
      expect(scroller === null ? true : overlay.contains(scroller)).toBe(false);
    },
  );

  it.each(Object.keys(U37_ARTIFACT_REPORT_SCENES))(
    'parks the %s outline on the scroller padded by the pinned height, with no second inset',
    async (id) => {
      const Scene = MOCK_SCENES[id];
      if (Scene === undefined) {
        throw new Error(`no scene ${id}`);
      }
      render(<Scene />);

      const rail = await screen.findByTestId('report-outline-rail', {}, SCENE_WAIT);
      await waitFor(() => expect(reportScroller()?.scrollTop).toBe(SCROLL_PX), SCENE_WAIT);
      const region = closest({ node: rail, selector: '[data-slot="reveal-region"]' });
      const overlay = region.querySelector<HTMLElement>('[data-slot="reveal-overlay"]');
      if (overlay === null) {
        throw new Error('no reveal overlay');
      }
      Object.defineProperty(overlay, 'offsetHeight', { configurable: true, value: PINNED_PX });
      observers.resizeAll();

      const scroller = rail.parentElement?.closest('.overflow-y-auto') ?? null;
      expect(scroller).toBe(reportScroller());
      expect(region.style.getPropertyValue('--reveal-inset')).toBe(`${PINNED_PX}px`);
      expect(region.contains(rail)).toBe(true);
      expect(overlay.contains(rail)).toBe(false);
    },
  );
});
