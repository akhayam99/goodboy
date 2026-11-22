// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U50_DESK_GRID_SCENES } from './deskGrid';

const SETTLE_MS = 2_000;

type SceneName = 'u50-desk-grid' | 'u50-desk-grid-terminal';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: Element,
  ) {
    return this.hasAttribute('data-dock-lane')
      ? new DOMRect(340, 120, 960, 600)
      : original.call(this);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U50_DESK_GRID_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown desk grid scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const lanePanel = () => document.querySelector<HTMLElement>('[data-drawer-lane]');

const cellKeys = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-dock-pane]')).map(
    (pane) => pane.dataset.dockPane ?? '',
  );

describe('the ux50 desk grid scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U50_DESK_GRID_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('lays the terminal in the lane beside the desk column', async () => {
    await mount('u50-desk-grid-terminal');

    expect(screen.getByRole('complementary', { name: 'Desk' })).toBeTruthy();
    expect(document.querySelector('[data-dock-lane]')).not.toBeNull();
    expect(lanePanel()).not.toBeNull();
    expect(cellKeys()).toEqual(['terminal']);
  });

  it('gives the panels back to the side of the page while an agent page covers the desk', async () => {
    await mount('u50-desk-grid-terminal');
    const sessionId = store.getState().currentSessionId;
    if (sessionId === null) {
      throw new Error('The scene opens a session');
    }

    await act(async () => {
      store.setState((state) => ({
        selectedAgentId: { ...state.selectedAgentId, [sessionId]: 'agent-1' },
      }));
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(document.querySelector('[data-dock-lane]')).toBeNull();
    expect(lanePanel()).toBeNull();
  });

  it('holds Terminal, Browser and Monitor in the grid with the detail beside them', async () => {
    await mount('u50-desk-grid');

    expect(lanePanel()).not.toBeNull();
    expect(cellKeys().length).toBeGreaterThan(0);
    expect(lanePanel()?.hasAttribute('data-detail-open')).toBe(true);
  });
});
