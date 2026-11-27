// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

vi.mock(
  '../../../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel',
  () => ({
    LazyGenericTerminalPanel: () => <div data-testid="terminal-panel" />,
  }),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../../../registry';
import { WINDOW_DOCK_SCENES } from './window-dock';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
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

describe('the window dock scenes', () => {
  it('registers every scene with the mock scene registry', () => {
    for (const name of Object.keys(WINDOW_DOCK_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('shows the scripts of every project on the Board, with no session open', async () => {
    const Scene = WINDOW_DOCK_SCENES['window-dock-board-scripts'];
    render(<Scene />);

    await screen.findByRole('region', { name: 'payments-api' });
    screen.getByRole('region', { name: 'notify-relay' });
    screen.getByRole('region', { name: 'ledger-core' });
    expect(useAppStore.getState().drawer).toMatchObject({ kind: 'scripts', sessionId: null });
  });

  it('counts the shell of another session under the Terminal on the Board', async () => {
    const Scene = WINDOW_DOCK_SCENES['window-dock-board-terminal'];
    render(<Scene />);

    await screen.findByText('1 shell running in other sessions');
    expect(useAppStore.getState().drawer).toMatchObject({ kind: 'terminal', sessionId: null });
  });
});
