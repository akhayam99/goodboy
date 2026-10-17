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

const rail = (): HTMLElement => screen.getByRole('navigation', { name: 'Session' });

const tools = (): HTMLElement => screen.getByRole('toolbar', { name: 'Session tools' });

const card = (name: string): HTMLElement => within(rail()).getByRole('group', { name });

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

  it('r4-rail-session draws the cards with each worktree pages inline, the tools outside the rail', async () => {
    await mount('r4-rail-session');

    const projects = card('Projects');
    expect(entryLabels(projects)).toEqual([
      'Pull request',
      'Comments',
      'Files',
      'Checks',
      'Pull request',
      'Comments',
      'Files',
      'Checks',
    ]);
    expect(
      within(projects)
        .getAllByRole('button', { name: /^Checks/ })[0]
        ?.getAttribute('aria-label'),
    ).toBe('Checks, 1 failing');
    expect(
      within(projects)
        .getAllByRole('button', { name: /^Comments/ })[0]
        ?.getAttribute('aria-label'),
    ).toBe('Comments, 2 need you');
    expect(card('Linked')).toBeDefined();
    expect(within(rail()).queryByRole('toolbar', { name: 'Session tools' })).toBeNull();
    expect(within(tools()).getAllByRole('button')).toHaveLength(5);
    const top = within(rail().querySelector<HTMLElement>('[data-rail-top]') ?? rail());
    expect(top.queryByRole('button', { name: 'More session actions' })).toBeNull();
    expect(top.getByRole('button', { name: 'Refresh session' })).toBeDefined();
    const foot = rail().querySelector<HTMLElement>('[data-session-foot]');
    expect(foot?.textContent).toBe('ArchiveDelete…');
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

  it('r4-rail-worktree drills into the worktree level with Files selected', async () => {
    await mount('r4-rail-worktree');

    expect(rail().getAttribute('data-session-rail')).toBe('worktree');
    const worktree = within(screen.getByRole('navigation', { name: 'Worktree' }));
    expect(worktree.getByRole('button', { name: /^Files/ }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('r4-rail-tools-open presses Context while its drawer is open', async () => {
    await mount('r4-rail-tools-open');

    expect(useAppStore.getState().drawer?.kind).toBe('context');
    const pressed = within(tools())
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.getAttribute('aria-label'));
    expect(pressed).toEqual(['Context']);
  });

  it('r4-rail-folded folds the rail with no foot and keeps the tools column', async () => {
    await mount('r4-rail-folded');

    expect(rail().hasAttribute('data-rail-folded')).toBe(true);
    expect(rail().querySelector('[data-session-foot]')).toBeNull();
    expect(within(tools()).getAllByRole('button')).toHaveLength(5);
  });

  it('r4-rail-delete opens the delete confirm from the foot', async () => {
    await mount('r4-rail-delete');

    const dialog = screen.getByRole('dialog', { name: /^Delete .+\?$/ });
    expect(within(dialog).getByRole('button', { name: 'Delete session' })).toBeDefined();
  });
});
