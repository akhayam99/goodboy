// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { SIDE_SLOT_RAIL_SCENES } from './session-rail';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
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
  clearSceneInvoke();
});

type SceneId = keyof typeof SIDE_SLOT_RAIL_SCENES;

const renderScene = (id: SceneId) => {
  const Scene = SIDE_SLOT_RAIL_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const WAIT = { timeout: 4_000 };

describe('the right rail scenes', () => {
  it('registers the waiting and pressed states', () => {
    expect(Object.keys(SIDE_SLOT_RAIL_SCENES).sort()).toEqual([
      'session-rail-pressed',
      'session-rail-waiting',
    ]);
  });

  it('waiting: the plan holds the slot and the rail rings Terminal', async () => {
    renderScene('session-rail-waiting');

    const terminal = await screen.findByRole('button', { name: 'Terminal, waiting' }, WAIT);
    expect(terminal.closest('[data-slot="session-tool"]')?.getAttribute('data-state')).toBe(
      'waiting',
    );
    expect(screen.getAllByTestId('tool-waiting')).toHaveLength(1);
  });

  it('pressed: Terminal holds the slot and nothing rings while the plan waits', async () => {
    renderScene('session-rail-pressed');

    const terminal = await screen.findByTestId('pane-toggle-terminal', undefined, WAIT);
    expect(terminal.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('tool-waiting')).toBeNull();
  });
});
