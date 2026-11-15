// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { runA11yCheck } from '../../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../../..';
import { U33_OVERVIEW_NEEDS_YOU_SCENES } from './overview-needs-you';

const WAIT = { timeout: 15_000 };
const SCENE = 'u33-overview-needs-you';

beforeAll(async () => {
  installFakeResizeObserver();
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
  localStorage.clear();
});

const mount = () => {
  const Scene = U33_OVERVIEW_NEEDS_YOU_SCENES[SCENE];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u33 overview needs you scene', () => {
  it('is registered once', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U33_OVERVIEW_NEEDS_YOU_SCENES[SCENE]);
  });

  it('holds one 680px frame with no padding on it', async () => {
    const { container } = mount();

    await waitFor(() => expect(container.querySelectorAll('[data-shot]')).toHaveLength(1), WAIT);
    const frame = container.querySelector<HTMLElement>('[data-shot]');
    expect(frame?.style.width).toBe('680px');
    expect(frame?.style.padding).toBe('');
  });

  it('draws one board whose rows each hold at most one filled verb', async () => {
    const { container } = mount();

    const board = await screen.findByRole('region', { name: 'Branches' }, WAIT);
    expect(board.querySelectorAll('[data-board-row]').length).toBeGreaterThan(0);
    for (const row of board.querySelectorAll('[data-board-row]')) {
      expect(row.querySelectorAll('[data-variant="primary"]').length).toBeLessThanOrEqual(1);
    }
    expect(container.querySelector('[data-overview-glance]')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = mount();

    await screen.findByRole('region', { name: 'Branches' }, WAIT);
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
