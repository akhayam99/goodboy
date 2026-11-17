// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { MOCK_SCENES } from '../../..';
import { U26S_SETTINGS_TREE_SCENES } from './SettingsTreeScene';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U26S_SETTINGS_TREE_SCENES;

type MountParams = {
  readonly id: SceneId;
};

const mount = async ({ id }: MountParams): Promise<HTMLElement> => {
  const Scene = U26S_SETTINGS_TREE_SCENES[id];
  render(<Scene />);
  return screen.findByRole('navigation', { name: 'Settings scopes' }, WAIT);
};

const title = (): string | null => screen.getByRole('heading', { level: 1 }).textContent;

describe('the Settings tree scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26S_SETTINGS_TREE_SCENES).sort()).toEqual([
      'u26s-settings-branches',
      'u26s-settings-general',
      'u26s-settings-iphone',
      'u26s-settings-nows',
      'u26s-settings-pair',
      'u26s-settings-storage',
      'u26s-settings-updates',
    ]);
    expect(MOCK_SCENES['u26s-settings-general']).toBe(
      U26S_SETTINGS_TREE_SCENES['u26s-settings-general'],
    );
  });

  it('u26s-settings-general draws the two scope labels and General with its Updates band', async () => {
    const rail = await mount({ id: 'u26s-settings-general' });

    expect(
      within(rail)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['This Macevery workspace', 'Harborlinethis workspace']);
    expect(title()).toBe('General');
    screen.getByRole('heading', { level: 2, name: 'Appearance' });
    screen.getByRole('heading', { level: 2, name: 'Updates' });
  });

  it('u26s-settings-updates opens General, where Updates is a band', async () => {
    await mount({ id: 'u26s-settings-updates' });

    expect(title()).toBe('General');
    screen.getByRole('switch', { name: 'Download in the background' });
    screen.getByRole('button', { name: "Open What's new" });
  });

  it('u26s-settings-storage keeps the cleanup policy as a row of Worktrees', async () => {
    await mount({ id: 'u26s-settings-storage' });

    expect(title()).toBe('Storage');
    const worktrees = await screen.findByRole('region', { name: 'Worktrees' }, WAIT);
    within(worktrees).getByRole('combobox', { name: 'Suggest cleanup after' });
    expect(screen.queryByRole('region', { name: 'Secrets in saved scripts' })).toBeNull();
  });

  it('u26s-settings-iphone lists the paired iPhone with Pair an iPhone in the header', async () => {
    await mount({ id: 'u26s-settings-iphone' });

    expect(title()).toBe('iPhone');
    expect(await screen.findByText('1 paired iPhone', undefined, WAIT)).toBeDefined();
    screen.getByRole('button', { name: 'Pair an iPhone' });
  });

  it('u26s-settings-pair shows the code in place with the testing note under it', async () => {
    await mount({ id: 'u26s-settings-pair' });

    expect(await screen.findByRole('progressbar', undefined, WAIT)).toBeDefined();
    screen.getByText('Goodboy for iPhone is in private testing');
  });

  it('u26s-settings-branches opens the workspace Branches page with settings only', async () => {
    await mount({ id: 'u26s-settings-branches' });

    expect(title()).toBe('Branches');
    screen.getByRole('region', { name: 'After merge' });
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Branches' })).toBeNull();
  });

  it('u26s-settings-nows says why the workspace group is empty', async () => {
    await mount({ id: 'u26s-settings-nows' });

    screen.getByText('Open a workspace to see its settings.');
  });
});
