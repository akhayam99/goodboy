// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { applyDocumentTheme } from '../../shared/lib/theme';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../test/sceneInvoke';
import { U25_R4_WORKSPACE_SCENES } from '../../app/components/MockScene/scenes/u25/r4-workspace';

const SETTLE_MS = 2_000;

const RAIL_ORDER = [
  'workspace',
  'new',
  'home',
  'board',
  'inbox',
  'workflows',
  'chat',
  'calendar',
  'connections',
  'impact',
  'settings',
  'report',
  'signature',
] as const;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
  applyDocumentTheme({ theme: 'dark' });
});

type MountParams = {
  readonly name: keyof typeof U25_R4_WORKSPACE_SCENES;
  readonly search?: string;
};

const mount = async ({ name, search = '' }: MountParams): Promise<void> => {
  window.history.replaceState(null, '', `/${search}`);
  const Scene = U25_R4_WORKSPACE_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const rail = () => screen.getByRole('navigation', { name: 'Places' });

const itemsOf = (): ReadonlyArray<string> =>
  Array.from(
    rail().querySelectorAll('[data-shell-rail-item]'),
    (item) => item.getAttribute('data-shell-rail-item') ?? '',
  );

describe('the places rail replaces the sidebar column', () => {
  it.each(['r4-column-dark', 'r4-column-light'] as const)(
    '%s draws New, the seven places, Settings, Report and the mark in one 64px rail, with no column, no list and no fold toggle',
    async (name) => {
      await mount({ name });

      expect(rail().style.width).toBe('64px');
      expect(itemsOf()).toEqual(RAIL_ORDER);
      expect(within(rail()).queryByRole('button', { name: /Monitoring|Terminal/ })).toBeNull();
      expect(screen.queryByRole('navigation', { name: 'Sidebar' })).toBeNull();
      expect(document.querySelector('[data-sidebar-toggle]')).toBeNull();
      expect(document.querySelector('[data-fold]')).toBeNull();
    },
  );

  it('keeps the same rail when a 0.39 window had the sidebar folded', async () => {
    await mount({ name: 'r4-column-dark', search: '?rail=1' });

    expect(rail().style.width).toBe('64px');
    expect(itemsOf()).toEqual(RAIL_ORDER);
  });
});
