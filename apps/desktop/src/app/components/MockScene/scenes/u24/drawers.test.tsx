// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_DRAWERS_SCENES } from './drawers';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.unstubAllGlobals();
});

const SIDEBAR_PX = 240;

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const stubColumnWidth = (width: number) => {
  class StubObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback([{ contentRect: { width } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
};

type SceneId = keyof typeof U24_DRAWERS_SCENES;

const renderScene = ({ id, windowPx }: { readonly id: SceneId; readonly windowPx: number }) => {
  stubColumnWidth(windowPx - SIDEBAR_PX);
  const Scene = U24_DRAWERS_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const panel = () => screen.getByRole('complementary', { name: 'Side panel' });

describe('the drawer split scenes', () => {
  it('registers the four scenes', () => {
    expect(Object.keys(U24_DRAWERS_SCENES)).toEqual([
      'drawer-split-plan',
      'drawer-split-plan-1280',
      'drawer-split-context',
      'drawer-split-explore',
    ]);
  });

  it('stands the plan drawer beside the page container at 1920, in the reader tier', async () => {
    const { container } = renderScene({ id: 'drawer-split-plan', windowPx: 1920 });

    await screen.findByTestId('plan-drawer');
    const page = container.querySelector('[data-container="page"]');
    const drawer = container.querySelector('[data-container="drawer"]');
    expect(panel().getAttribute('data-drawer-sizing')).toBe('reader');
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe('736px');
    expect(page?.contains(drawer ?? null)).toBe(false);
    expect(page?.getAttribute('data-sheet')).toBe('pushed');
  });

  it('lifts the plan drawer over the page container at 1280, never squeezing it', async () => {
    const { container } = renderScene({ id: 'drawer-split-plan-1280', windowPx: 1280 });

    await screen.findByTestId('plan-drawer');
    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().style.width).toBe('728px');
    expect(container.querySelector('[data-drawer-scrim]')).not.toBeNull();
    expect(container.querySelector('[data-container="page"]')?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('[data-container="page"]')?.getAttribute('data-sheet')).toBe(
      'wrapped',
    );
  });

  it('keeps the context drawer in the side tier, pushed at 1440', async () => {
    renderScene({ id: 'drawer-split-context', windowPx: 1440 });

    await screen.findByRole('complementary', { name: 'Side panel' });
    expect(useAppStore.getState().drawer?.kind).toBe('context');
    expect(panel().getAttribute('data-drawer-sizing')).toBe('side');
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe('416px');
  });

  it('opens the Explore file drawer in the reader tier, pushed at 1920', async () => {
    renderScene({ id: 'drawer-split-explore', windowPx: 1920 });

    await screen.findByRole('complementary', { name: 'Side panel' });
    expect(useAppStore.getState().drawer?.kind).toBe('explore-file');
    expect(panel().getAttribute('data-drawer-sizing')).toBe('reader');
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
  });
});
