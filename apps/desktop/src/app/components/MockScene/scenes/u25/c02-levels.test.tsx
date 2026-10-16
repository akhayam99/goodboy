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
  document.querySelector('[data-sidebar-level]')?.getAttribute('data-sidebar-level') ?? null;

const sessionLayer = (): HTMLElement => {
  const layer = document.querySelector<HTMLElement>('[data-level-layer="session"]');
  if (layer === null) {
    throw new Error('no session layer');
  }
  return layer;
};

describe('the c02 sidebar level scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U25_C02_LEVEL_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('c02-level-workspace shows New session, the doors and the sessions, with Sessions current', async () => {
    await mount('c02-level-workspace');

    expect(levelOf()).toBe('workspace');
    expect(screen.getByRole('button', { name: 'New session' })).toBeDefined();
    expect(document.querySelector('[data-column-door="board"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(document.querySelector('[data-level-layer="session"]')).toBeNull();
  });

  it('c02-level-session shows back row, identity, counted pages, projects and linked work', async () => {
    await mount('c02-level-session');

    expect(levelOf()).toBe('session');
    const level = within(sessionLayer());
    expect(level.getByRole('button', { name: 'Back to Sessions' })).toBeDefined();
    expect(level.getByText('Retry failed webhook deliveries')).toBeDefined();
    const pages = within(level.getByRole('list', { name: 'Pages' }));
    expect(pages.getAllByRole('button').map((row) => row.textContent)).toEqual([
      'Overview',
      'Runs1',
      'Orchestrated',
      'Agents3',
      'Artifacts3',
      'Questions1',
    ]);
    expect(
      sessionLayer().querySelector('[data-page-value="runs"]')?.getAttribute('data-tone'),
    ).toBe('running');
    const projects = within(level.getByRole('group', { name: 'Projects' }));
    expect(projects.getByText('#331')).toBeDefined();
    expect(within(level.getByRole('group', { name: 'Linked' })).getByText('NW-142')).toBeDefined();
  });

  it('c02-level-session-agents marks Agents as the one current entry', async () => {
    await mount('c02-level-session-agents');

    const current = Array.from(sessionLayer().querySelectorAll('[aria-current="page"]'));
    expect(current.map((row) => row.textContent)).toEqual(['Agents3']);
  });

  it('c02-level-branchless shows File versions and no Projects', async () => {
    await mount('c02-level-branchless');

    const level = within(sessionLayer());
    expect(level.getByRole('button', { name: /^File versions/ })).toBeDefined();
    expect(level.queryByRole('group', { name: 'Projects' })).toBeNull();
  });

  it('c02-level-left shows the workspace level with the session row still selected', async () => {
    await mount('c02-level-left');

    expect(levelOf()).toBe('workspace');
    const current = document.querySelector('[data-level-layer="workspace"] [aria-current="page"]');
    expect(current?.textContent).toContain('Retry failed webhook deliveries');
  });

  it('c02-level-folded shows the session level as icons with the back icon first', async () => {
    await mount('c02-level-folded');

    const rail = document.querySelector<HTMLElement>('[data-column-rail]');
    expect(rail?.getAttribute('data-sidebar-level')).toBe('session');
    expect(
      within(rail ?? document.body)
        .getAllByRole('button')[1]
        ?.getAttribute('aria-label'),
    ).toBe('Back to Sessions');
  });

  it('c02-level-studio-over shows the workspace level while Tasks sits over the session', async () => {
    await mount('c02-level-studio-over');

    expect(levelOf()).toBe('workspace');
    expect(document.querySelector('[data-column-door="inbox"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('c02-shell-overview draws the Overview page header with Ask and no trail band', async () => {
    await mount('c02-shell-overview');

    expect(screen.getByRole('heading', { name: 'Overview', level: 1 })).toBeDefined();
    expect(screen.getAllByTestId('pane-toggle-ask').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-slot="trail-bar"]')).toBeNull();
  });
});
