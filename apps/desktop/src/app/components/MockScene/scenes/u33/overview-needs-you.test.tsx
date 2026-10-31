// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
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

  it('shows two Decide rows and one Fix row, then the rows that wait for you', async () => {
    const { container } = mount();

    const needsYou = await screen.findByRole('region', { name: 'Needs you' }, WAIT);
    expect(
      [...needsYou.querySelectorAll('[data-next-group-head]')].map((head) => head.textContent),
    ).toEqual(['Decide2', 'Fix1']);
    expect(needsYou.querySelectorAll('[data-action-card]')).toHaveLength(3);
    const waiting = within(container).getByRole('group', { name: 'Waiting for you' });
    expect(waiting.querySelectorAll('[data-live-row]')).toHaveLength(2);
  });

  it('has no accessibility violations', async () => {
    const { container } = mount();

    await screen.findByRole('region', { name: 'Needs you' }, WAIT);
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
