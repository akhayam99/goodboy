// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_C02_LEVEL_SCENES } from './c02-levels';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_C02_LEVEL_SCENES;

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
  const Scene = U25_C02_LEVEL_SCENES[name];
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

const levelOf = (): string | null =>
  document.querySelector('[data-session-rail]')?.getAttribute('data-session-rail') ?? null;

const mainSidebar = (): HTMLElement => {
  const nav = document.querySelector<HTMLElement>('[data-column-layer="nav"], [data-column-rail]');
  if (nav === null) {
    throw new Error('no main sidebar');
  }
  return nav;
};

const sessionLayer = (): HTMLElement => {
  const layer = document.querySelector<HTMLElement>('[data-level-layer="session"]');
  if (layer === null) {
    throw new Error('no session layer');
  }
  return layer;
};

describe('the c02 sidebar and session rail scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U25_C02_LEVEL_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('c02-level-workspace shows New session, the doors and the sessions, with Sessions current', async () => {
    await mount('c02-level-workspace');

    expect(levelOf()).toBeNull();
    expect(screen.getByRole('button', { name: 'New session' })).toBeDefined();
    expect(document.querySelector('[data-column-door="board"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(document.querySelector('[data-level-layer="session"]')).toBeNull();
  });

  it('c02-level-session keeps the workspace sidebar and shows pages, projects and linked work in the rail, no identity row', async () => {
    await mount('c02-level-session');

    expect(levelOf()).toBe('session');
    expect(mainSidebar().querySelector('[data-column-door="board"]')).not.toBeNull();
    expect(mainSidebar().querySelector('[data-level-layer]')).toBeNull();
    const level = within(sessionLayer());
    expect(level.queryByRole('button', { name: 'Back to Sessions' })).toBeNull();
    expect(level.queryByText('Retry failed webhook deliveries')).toBeNull();
    expect(
      within(mainSidebar()).getByRole('option', { name: /^Retry failed webhook deliveries/ }),
    ).toBeDefined();
    const pages = within(level.getByRole('list', { name: 'Pages' }));
    expect(pages.getAllByRole('button').map((row) => row.textContent)).toEqual([
      'Overview',
      'Runs1',
      'Artifacts3',
      'Questions1',
    ]);
    expect(
      sessionLayer().querySelector('[data-page-value="runs"]')?.getAttribute('data-tone'),
    ).toBe('info');
    const projects = within(level.getByRole('group', { name: 'Projects' }));
    expect(projects.getByRole('button', { name: /#331/ })).toBeDefined();
    expect(within(level.getByRole('group', { name: 'Linked' })).getByText('NW-142')).toBeDefined();
    const adds = [
      projects.getByRole('button', { name: 'Add folder' }),
      within(level.getByRole('group', { name: 'Linked' })).getByRole('button', {
        name: 'Link work',
      }),
    ];
    for (const add of adds) {
      expect(add.textContent).toBe('');
      expect(add.getAttribute('data-variant')).toBe('ghost');
      expect(add.hasAttribute('data-level-add')).toBe(true);
    }
  });

  it('c02-level-session-agents marks Runs, where agents now live, as the one current entry', async () => {
    await mount('c02-level-session-agents');

    const current = Array.from(sessionLayer().querySelectorAll('[aria-current="page"]'));
    expect(current.map((row) => row.textContent)).toEqual(['Runs1']);
  });

  it('c02-level-branchless shows Changes and no Projects', async () => {
    await mount('c02-level-branchless');

    const level = within(sessionLayer());
    expect(level.getByRole('button', { name: /^Changes/ })).toBeDefined();
    expect(level.queryByRole('group', { name: 'Projects' })).toBeNull();
  });

  it('c02-level-main-folded folds the main sidebar to its icons and keeps the rail open', async () => {
    await mount('c02-level-main-folded');

    expect(document.querySelector('[data-column-rail]')).not.toBeNull();
    expect(levelOf()).toBe('session');
    expect(document.querySelector('[data-session-rail]')?.hasAttribute('data-rail-folded')).toBe(
      false,
    );
    expect(within(sessionLayer()).getByRole('list', { name: 'Pages' })).toBeDefined();
  });

  it('c02-level-folded folds the session rail to its page icons beside the open sidebar', async () => {
    await mount('c02-level-folded');

    const rail = document.querySelector<HTMLElement>('[data-session-rail]');
    expect(rail?.hasAttribute('data-rail-folded')).toBe(true);
    expect(rail?.querySelector('[data-rail-level="session"]')).not.toBeNull();
    expect(within(rail ?? document.body).getByRole('button', { name: /^Runs/ })).toBeDefined();
    expect(document.querySelector('[data-column-layer="nav"]')).not.toBeNull();
  });

  it('c02-level-studio-over selects Tasks in the sidebar while it sits over the session', async () => {
    await mount('c02-level-studio-over');

    expect(levelOf()).toBeNull();
    expect(document.querySelector('[data-column-door="inbox"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('c02-shell-overview draws the Overview page header (the session name) with Ask and no trail band', async () => {
    await mount('c02-shell-overview');

    expect(screen.getByTestId('overview-title').closest('h1')).not.toBeNull();
    expect(screen.getAllByTestId('pane-toggle-ask').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-slot="trail-bar"]')).toBeNull();
  });
});
