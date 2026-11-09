// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U39_P7_SCENES } from './p7-session-pages';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U39_P7_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U39_P7_SCENES[name];
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

const rail = (): HTMLElement => {
  const nav = document.querySelector<HTMLElement>('[data-session-rail]');
  if (nav === null) {
    throw new Error('no session pages rail');
  }
  return nav;
};

const pageLabelsOf = (): ReadonlyArray<string> =>
  within(rail())
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '');

describe('the ux39 P7 session pages scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U39_P7_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('ux39-p7-open lists the pages with Questions marked and no actions block at the foot', async () => {
    await mount('ux39-p7-open');

    expect(rail().getAttribute('aria-label')).toBe('Session pages');
    expect(rail().hasAttribute('data-rail-folded')).toBe(false);
    expect(rail().querySelector('[data-rail-actions]')).toBeNull();
    expect(within(rail()).getByRole('button', { name: 'Refresh session' })).toBeDefined();
    expect(rail().querySelector('[data-page-value="questions"]')?.getAttribute('data-tone')).toBe(
      'warning',
    );
  });

  it('ux39-p7-open-branchless draws the pages of a plain folder', async () => {
    await mount('ux39-p7-open-branchless');

    expect(rail().hasAttribute('data-rail-folded')).toBe(false);
    expect(within(rail()).getByRole('button', { name: /^Overview/ })).toBeDefined();
  });

  it('ux39-p7-folded draws one icon per page with the menu at the foot', async () => {
    await mount('ux39-p7-folded');

    expect(rail().hasAttribute('data-rail-folded')).toBe(true);
    const actions = rail().querySelector('[data-rail-actions]');
    expect(actions).not.toBeNull();
    expect(rail().lastElementChild).toBe(actions);
    expect(pageLabelsOf()).toContain('Show session pages');
    expect(within(rail()).getByRole('button', { name: 'More session actions' })).toBeDefined();
    expect(
      rail().querySelector('[data-rail-page="page-questions"] span[aria-hidden]'),
    ).not.toBeNull();
  });

  it('ux39-p7-folded-branchless draws the plain folder pages as icons', async () => {
    await mount('ux39-p7-folded-branchless');

    expect(rail().hasAttribute('data-rail-folded')).toBe(true);
    expect(rail().querySelector('[data-rail-actions]')).not.toBeNull();
    expect(rail().querySelector('[data-rail-page="page-overview"]')).not.toBeNull();
  });

  it('ux39-p7-folded-menu opens the session menu with five rows at most', async () => {
    await mount('ux39-p7-folded-menu');

    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it('ux39-p7-runs-waiting counts the waiting run in warning on the Runs row', async () => {
    await mount('ux39-p7-runs-waiting');

    const value = rail().querySelector('[data-page-value="runs"]');
    expect(value?.getAttribute('data-tone')).toBe('warning');
  });

  it('ux39-p7-runs-waiting-folded marks the Runs icon with a dot', async () => {
    await mount('ux39-p7-runs-waiting-folded');

    expect(rail().hasAttribute('data-rail-folded')).toBe(true);
    expect(rail().querySelector('[data-rail-page="page-runs"] span[aria-hidden]')).not.toBeNull();
  });
});
