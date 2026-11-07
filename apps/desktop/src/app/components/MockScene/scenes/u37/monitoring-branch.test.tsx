// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U37_MONITORING_BRANCH_SCENES } from './monitoring-branch';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
});

const BRANCH = 'hl/fix-duplicate-credit';

const hasPortRow = (port: number): boolean =>
  document.querySelector(`[data-port-row="${port}"]`) !== null;

const renderScene = () => {
  const Scene = U37_MONITORING_BRANCH_SCENES['u37-monitoring-branch'];
  render(<Scene />);
};

describe('the u37 monitoring branch scene', () => {
  it('registers the scene', () => {
    expect(MOCK_SCENES['u37-monitoring-branch']).toBeDefined();
  });

  it('opens Monitoring filtered to the branch of the address', async () => {
    renderScene();

    await waitFor(() => expect(hasPortRow(5173)).toBe(true), { timeout: 4000 });
    expect(hasPortRow(5005)).toBe(true);
    expect(store.getState().appStudio).toMatchObject({
      kind: 'monitoring',
      target: { branch: BRANCH },
    });
    screen.getByRole('button', { name: `Show every port, not only ${BRANCH}` });
  });

  it('shows every port again when the chip is cleared', async () => {
    renderScene();
    await waitFor(() => expect(hasPortRow(5173)).toBe(true), { timeout: 4000 });

    expect(screen.queryByRole('region', { name: 'Listening on this Mac' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: `Show every port, not only ${BRANCH}` }));

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Listening on this Mac' })).not.toBeNull(),
    );
    expect(screen.queryByRole('button', { name: /^Show every port/ })).toBeNull();
    expect(store.getState().appStudio).toEqual({ kind: 'monitoring', target: null });
  });
});
