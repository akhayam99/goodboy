// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
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

  it('u26s-settings-general draws the four labels and General without Updates', async () => {
    const rail = await mount({ id: 'u26s-settings-general' });

    expect(
      within(rail)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['App', 'Workspace · Harborline', 'Providers and models', 'Integrations']);
    expect(title()).toBe('General');
    screen.getByRole('heading', { level: 2, name: 'Appearance' });
    expect(screen.queryByRole('switch', { name: 'Download updates in the background' })).toBeNull();
  });

  it('u26s-settings-updates gives Updates its own page', async () => {
    await mount({ id: 'u26s-settings-updates' });

    expect(title()).toBe('Updates');
    screen.getByRole('switch', { name: 'Download updates in the background' });
    screen.getByRole('button', { name: "Open What's new" });
  });

  it('u26s-settings-storage ends Storage with the security findings', async () => {
    await mount({ id: 'u26s-settings-storage' });

    expect(title()).toBe('Storage');
    expect(
      await screen.findByText('No findings in your saved scripts.', undefined, WAIT),
    ).toBeDefined();
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

  it('u26s-settings-branches opens the workspace Branches page with After merge first', async () => {
    await mount({ id: 'u26s-settings-branches' });

    expect(title()).toBe('Branches');
    screen.getByRole('region', { name: 'When a pull request merges' });
    screen.getByRole('button', { name: 'Check again' });
  });

  it('u26s-settings-nows says why the workspace groups are empty', async () => {
    await mount({ id: 'u26s-settings-nows' });

    screen.getByText('Open a workspace to see its settings.');
    screen.getByText('Integrations belong to a workspace.');
  });
});
