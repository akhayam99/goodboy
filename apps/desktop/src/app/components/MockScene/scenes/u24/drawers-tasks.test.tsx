// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_DRAWERS_TASKS_SCENES } from './drawers-tasks';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.unstubAllGlobals();
});

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

describe('the Tasks drawer split scene', () => {
  it('registers one scene', () => {
    expect(Object.keys(U24_DRAWERS_TASKS_SCENES)).toEqual(['drawer-split-tasks']);
  });

  it('stands the record drawer beside the page container inside the studio, with no band', async () => {
    stubColumnWidth(1600);
    const Scene = U24_DRAWERS_TASKS_SCENES['drawer-split-tasks'];
    const { container } = render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await screen.findByRole('complementary', { name: 'Task' });
    const slot = container.querySelector<HTMLElement>('[data-studio-slot="content"]');
    const page = slot?.querySelector<HTMLElement>('[data-container="page"]');
    const drawer = slot?.querySelector<HTMLElement>('[data-container="drawer"]');

    expect(
      screen.getByRole('complementary', { name: 'Task' }).getAttribute('data-drawer-mode'),
    ).toBe('push');
    expect(page?.getAttribute('data-sheet')).toBe('pushed');
    expect(page?.querySelector('[data-studio-band]')).toBeNull();
    expect(page?.textContent).toContain('Tasks');
    expect(drawer?.textContent).toContain('CAS-231');
    expect(page?.contains(drawer ?? null)).toBe(false);
  });

  it('fades the record panel in with the page, then leaves a later panel to the drawer motion', async () => {
    stubColumnWidth(1600);
    const Scene = U24_DRAWERS_TASKS_SCENES['drawer-split-tasks'];
    const { container } = render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const panel = await screen.findByRole('complementary', { name: 'Task' });
    const motions = Array.from(container.querySelectorAll<HTMLElement>('[data-studio-motion]'));
    const pageMotion = motions.find((node) => !node.contains(panel) && !panel.contains(node));
    const panelMotion = motions.find((node) => panel.contains(node));

    expect(pageMotion?.getAttribute('data-studio-motion')).toBe('in');
    expect(panelMotion?.getAttribute('data-studio-motion')).toBe('in');

    if (pageMotion !== undefined) {
      fireEvent.animationEnd(pageMotion);
    }
    expect(panelMotion?.getAttribute('data-studio-motion')).toBe('settled');
  });
});
