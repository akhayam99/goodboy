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
import { U42_PANEL_FRAME_SCENES } from './panel-frame';

const SETTLE_MS = 2_000;

type MountParams = {
  readonly name: string;
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
  const Scene = U42_PANEL_FRAME_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
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

const side = () => screen.getByRole('complementary', { name: 'Side panel' });

describe('the ux42 panel frame scenes', () => {
  it('panel-frame-detail-terminal shows the artifact detail and the Terminal dock together', async () => {
    await mount({ name: 'panel-frame-detail-terminal' });
    const state = useAppStore.getState();

    expect(selectDockDrawer({ state })?.kind).toBe('terminal');
    expect(selectDetailDrawer({ state })?.kind).toBe('artifact');
    expect(side().querySelector('[data-container="detail"] [data-detail-card]')).not.toBeNull();
    expect(side().querySelector('[data-container="drawer"] [data-drawer-card]')).not.toBeNull();
  });

  it('panel-frame-detail opens the detail alone, the dock closed', async () => {
    await mount({ name: 'panel-frame-detail' });
    const state = useAppStore.getState();

    expect(selectDockDrawer({ state })).toBeNull();
    expect(selectDetailDrawer({ state })?.kind).toBe('artifact');
  });

  it.each(['panel-frame-terminal', 'panel-frame-browser'])(
    '%s docks its tool on the rail surface',
    async (name) => {
      await mount({ name });

      expect(selectDockDrawer({ state: useAppStore.getState() })).not.toBeNull();
      expect(side().querySelector('[data-container="drawer"]')?.className).toContain('bg-drawer');
    },
  );
});
