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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../../../registry';
import { DOCK_CHROME_SCENES } from './dockChrome';

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

describe('the dock chrome scenes', () => {
  it('registers every scene with the mock scene registry', () => {
    for (const name of Object.keys(DOCK_CHROME_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('holds the monitor search in one row under its head', async () => {
    const Scene = DOCK_CHROME_SCENES['dock-chrome-monitor'];
    render(<Scene />);

    const search = await screen.findByRole('searchbox', { name: 'Search ports' });
    expect(search.closest('[data-dock-tool-row]')).not.toBeNull();
    expect(document.querySelectorAll('[data-dock-tool-row]')).toHaveLength(1);
    expect(document.querySelector('[data-drawer-meta]')).toBeNull();
  });

  it('folds the switcher of a merged slot into its head and keeps one tool row', async () => {
    const Scene = DOCK_CHROME_SCENES['dock-chrome-merged'];
    render(<Scene />);

    await waitFor(() => {
      const tabs = screen.getByRole('tablist', { name: 'Panels' });
      expect(tabs.closest('[data-dock-panel-head]')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Terminal' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Terminal' }).getAttribute('aria-selected')).toBe(
        'true',
      );
    });
    await waitFor(() => {
      expect(document.querySelectorAll('[data-dock-tool-row]')).toHaveLength(1);
    });
    expect(document.querySelectorAll('[data-dock-cell-tabs]')).toHaveLength(1);
  });
});
