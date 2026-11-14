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
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_R4_RAIL_SCENES } from './r4-rail';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_R4_RAIL_SCENES;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_R4_RAIL_SCENES[name];
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

const tabs = (): HTMLElement => screen.getByRole('tablist', { name: 'Session pages' });

const tools = (): HTMLElement => screen.getByRole('toolbar', { name: 'Tools' });

const cardsLayer = (): HTMLElement => {
  const layer = document.querySelector<HTMLElement>('[data-level-layer="session"]');
  if (layer === null) {
    throw new Error('the Context tab shows no cards');
  }
  return layer;
};

const card = (name: string): HTMLElement => within(cardsLayer()).getByRole('group', { name });

const entryLabels = (scope: HTMLElement): ReadonlyArray<string> =>
  [...scope.querySelectorAll('[data-worktree-entries] [data-entry-label]')].map(
    (label) => label.textContent ?? '',
  );

describe('r4 session rail scenes', () => {
  it('registers every scene with the mock scene registry', () => {
    for (const name of Object.keys(U25_R4_RAIL_SCENES)) {
      expect(MOCK_SCENES[name]).toBeDefined();
    }
  });

  it('r4-rail-session draws the cards in the Context tab with one line per branch, the tools outside the tabs', async () => {
    await mount('r4-rail-session');

    const projects = card('Projects');
    expect(entryLabels(projects)).toEqual([]);
    expect(projects.querySelectorAll('[data-worktree-branch]').length).toBeGreaterThan(0);
    expect(card('Linked')).toBeDefined();
    expect(within(tabs()).queryByRole('toolbar', { name: 'Tools' })).toBeNull();
    expect(within(tools()).getAllByRole('button')).toHaveLength(7);
    screen.getByRole('button', { name: 'More session actions' });
    screen.getByRole('button', { name: 'Refresh session' });
  });

  it('r4-rail-cards-folded folds both cards and keeps the failing check as one header dot', async () => {
    await mount('r4-rail-cards-folded');

    expect(
      within(card('Projects'))
        .getByRole('button', { name: 'Projects' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(card('Projects').querySelector('[data-card-signal]')).not.toBeNull();
    expect(
      within(card('Linked')).getByRole('button', { name: 'Linked' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('r4-rail-tools-open presses Context while its drawer is open', async () => {
    await mount('r4-rail-tools-open');

    expect(useAppStore.getState().drawer?.kind).toBe('context');
    const pressed = within(tools())
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.getAttribute('aria-label'));
    expect(pressed).toEqual(['Context']);
    expect(document.querySelector('[data-slot="page-trail"]')).toBeNull();
  });

  it('r4-rail-tree draws many branches one line each in rank order, with the finished ones folded', async () => {
    await mount('r4-rail-tree');

    const projects = card('Projects');
    const live = [...projects.querySelectorAll('ul[aria-label$=" worktrees"] [data-pr-state]')].map(
      (icon) => icon.getAttribute('data-pr-state'),
    );
    expect(live).toEqual(['queued', 'open', 'draft', 'approved', 'open', 'none']);
    expect(
      within(projects)
        .getAllByRole('button', { name: /\d+ finished/ })
        .map((fold) => fold.textContent),
    ).toEqual(['2 finished']);
    expect(projects.querySelectorAll('[data-worktree-entries]')).toHaveLength(0);
  });

  it('r4-rail-tree cuts long titles at the end only and keeps the branch in the tooltip and the name', async () => {
    await mount('r4-rail-tree');

    const projects = card('Projects');
    for (const cell of projects.querySelectorAll('[data-worktree-branch]')) {
      expect(cell.querySelector('.shrink-0')).toBeNull();
      expect(cell.querySelector('[title]')).toBeNull();
    }
    const rows = within(projects).getAllByRole('button', {
      name: /branch ak\/eng-1200-retry-header-for-notify-relay-with-backoff-draft/,
    });
    expect(rows.length).toBeGreaterThan(0);
  });

  it('r4-rail-delete opens the delete confirm from the session menu', async () => {
    await mount('r4-rail-delete');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    const dialog = screen.getByRole('dialog', { name: /^Delete .+\?$/ });
    within(dialog).getByRole('button', { name: /^Delete/ });
  });
});
