// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U31_SIDEBAR_SCENES } from './sidebar';

const WAIT = { timeout: 15_000 };

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
  const Scene = U31_SIDEBAR_SCENES['u31-sidebar'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the sidebar scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U31_SIDEBAR_SCENES)).toEqual(['u31-sidebar']);
    expect(MOCK_SCENES['u31-sidebar']).toBe(U31_SIDEBAR_SCENES['u31-sidebar']);
  });

  it('frames the capture on one element whose padding sits on an inner element', async () => {
    const { container } = mount();

    await screen.findByRole('heading', { level: 2, name: 'Projects' }, WAIT);
    const frames = container.querySelectorAll<HTMLElement>('[data-shot]');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.style.width).toBe('680px');
    expect(frames[0]?.style.padding).toBe('');
    expect(frames[0]?.children).toHaveLength(1);
  });

  it('names both groups as headings, found by role', async () => {
    mount();

    await screen.findByRole('heading', { level: 2, name: 'Projects' }, WAIT);
    await screen.findByRole('heading', { level: 2, name: 'Linked' }, WAIT);
  });

  it('lists both projects with their branch rows named by the branch', async () => {
    const { container } = mount();

    await screen.findByRole('heading', { level: 2, name: 'Projects' }, WAIT);
    expect(
      [...container.querySelectorAll('[data-card-project]')].map((card) =>
        card.getAttribute('data-card-project'),
      ),
    ).toEqual(['payments-api', 'notify-relay']);
    const branches = [
      ...container.querySelectorAll('[data-worktree-branch][data-title-kind="branch"]'),
    ].map((branch) => branch.textContent);
    expect(branches).toEqual([
      'hl/fix-webhook-idempotency',
      'hl/fix-duplicate-credit',
      'hl/surface-retry-state',
    ]);
  });

  it('shows two linked items under Linked', async () => {
    mount();

    const linked = await screen.findByRole('group', { name: 'Linked' }, WAIT);
    within(linked).getByRole('button', { name: 'Open issue #57' });
    expect(within(linked).getAllByRole('listitem').length).toBeGreaterThan(1);
  });

  it('marks at most one door as the current page', async () => {
    const { container } = mount();

    await screen.findByRole('heading', { level: 2, name: 'Projects' }, WAIT);
    expect(
      container.querySelectorAll('[data-column-door][aria-current="page"]').length,
    ).toBeLessThan(2);
  });
});
