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
import { selectDetailDrawer } from '../../../../../store/slices/drawer/selectDetailDrawer';
import { selectDockDrawer } from '../../../../../store/slices/drawer/selectDockDrawer';
import { MOCK_SCENES } from '../..';
import { U48_TOOL_RAIL_SCENES } from './tool-rail';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U48_TOOL_RAIL_SCENES;

type MountParams = {
  readonly name: SceneName;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U48_TOOL_RAIL_SCENES[name];
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

const container = () =>
  screen
    .getByRole('complementary', { name: 'Side panel' })
    .querySelector('[data-container="drawer"]');

const tools = () => screen.getByRole('toolbar', { name: 'Tools' });

describe('the u48 tool rail scenes', () => {
  it('registers every scene', () => {
    for (const [id, scene] of Object.entries(U48_TOOL_RAIL_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('u48-tool-rail-closed holds the five tools alone on the window edge', async () => {
    await mount({ name: 'u48-tool-rail-closed' });

    expect(selectDockDrawer({ state: useAppStore.getState() })).toBeNull();
    expect(container()?.lastElementChild?.contains(tools())).toBe(true);
    expect(container()?.querySelector('[data-drawer-card]')).toBeNull();
    expect(tools().querySelectorAll('[data-slot="session-tool"]')).toHaveLength(5);
  });

  it('u48-tool-rail-monitor opens Monitor to the left of the rail, pressed and numbered', async () => {
    await mount({ name: 'u48-tool-rail-monitor' });

    expect(selectDockDrawer({ state: useAppStore.getState() })?.kind).toBe('monitoring');
    expect(container()?.firstElementChild?.hasAttribute('data-drawer-card')).toBe(true);
    expect(container()?.lastElementChild?.contains(tools())).toBe(true);
    expect(screen.getByTestId('pane-toggle-monitoring').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: 'Monitoring' })).not.toBeNull();
  });

  it('u48-tool-rail-detail-monitor reads page, detail, Monitor, rail from left to right', async () => {
    await mount({ name: 'u48-tool-rail-detail-monitor' });
    const state = useAppStore.getState();

    expect(selectDetailDrawer({ state })?.kind).toBe('artifact');
    expect(selectDockDrawer({ state })?.kind).toBe('monitoring');
    const detail = document.querySelector('[data-detail-group]');
    const dock = container();
    expect(detail?.compareDocumentPosition(dock ?? document.body)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
