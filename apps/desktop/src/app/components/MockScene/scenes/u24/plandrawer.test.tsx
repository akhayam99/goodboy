// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_PLANDRAWER_SCENES } from './plandrawer';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.unstubAllGlobals();
});

const SIDEBAR_PX = 240;
const WINDOW_PX = 1920;

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

type SceneId = keyof typeof U24_PLANDRAWER_SCENES;

const renderScene = (id: SceneId) => {
  stubColumnWidth(WINDOW_PX - SIDEBAR_PX);
  const Scene = U24_PLANDRAWER_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const panel = () => screen.getByRole('complementary', { name: 'Side panel' });

const headerButtons = (frame: HTMLElement): ReadonlyArray<string | null> =>
  Array.from(frame.querySelectorAll('header button')).map((button) =>
    button.getAttribute('aria-label'),
  );

describe('the plan and report drawer scenes', () => {
  it('registers the three scenes', () => {
    expect(Object.keys(U24_PLANDRAWER_SCENES)).toEqual([
      'plandrawer-720',
      'plandrawer-1000',
      'reportdrawer-720',
    ]);
  });

  it('opens the plan drawer at 720 with two icons and no Expand', async () => {
    renderScene('plandrawer-720');

    await screen.findByTestId('plan-drawer');
    expect(panel().getAttribute('data-drawer-sizing')).toBe('reader');
    expect(panel().style.width).toBe('736px');
    const frame = within(panel()).getByRole('region');
    expect(headerButtons(frame)).toContain('Open in Artifacts');
    expect(headerButtons(frame)).toContain('Copy markdown');
    expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More plan actions' })).toBeNull();
  });

  it('draws the plan drawer at 1000 from its saved width, pushed beside the page', async () => {
    renderScene('plandrawer-1000');

    await screen.findByTestId('plan-drawer');
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe('1016px');
    expect(screen.getByTestId('plan-drawer').closest('[data-page-column]')).not.toBeNull();
  });

  it('opens the report drawer at 720 with Open in Artifacts only', async () => {
    renderScene('reportdrawer-720');

    await screen.findByTestId('artifact-reading-drawer');
    expect(panel().style.width).toBe('736px');
    const frame = within(panel()).getByRole('region');
    expect(headerButtons(frame)).toEqual(['Open in Artifacts', 'Close']);
  });
});
