// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
      'u26s-bar-iphone-fault',
      'u26s-bar-iphone-live',
      'u26s-bar-iphone-none',
      'u26s-bar-iphone-offline',
      'u26s-bar-iphone-open',
      'u26s-settings-branches',
      'u26s-settings-general',
      'u26s-settings-iphone',
      'u26s-settings-iphone-empty',
      'u26s-settings-iphone-fault',
      'u26s-settings-iphone-request',
      'u26s-settings-nows',
      'u26s-settings-pair',
      'u26s-settings-storage',
      'u26s-settings-updates',
    ]);
    expect(MOCK_SCENES['u26s-settings-general']).toBe(
      U26S_SETTINGS_TREE_SCENES['u26s-settings-general'],
    );
  });

  it('u26s-settings-general draws the two scope labels and Look and alerts with its Updates band', async () => {
    const rail = await mount({ id: 'u26s-settings-general' });

    expect(
      within(rail)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['This Macevery workspace', 'Harborlinethis workspace']);
    expect(title()).toBe('Look and alerts');
    screen.getByRole('heading', { level: 2, name: 'Appearance' });
    screen.getByRole('heading', { level: 2, name: 'Updates' });
  });

  it('u26s-settings-updates opens Look and alerts, where Updates is a band', async () => {
    await mount({ id: 'u26s-settings-updates' });

    expect(title()).toBe('Look and alerts');
    screen.getByRole('switch', { name: 'Download in the background' });
    screen.getByRole('button', { name: "Open What's new" });
  });

  it('u26s-settings-storage keeps the cleanup policy as a row of Worktrees', async () => {
    await mount({ id: 'u26s-settings-storage' });

    expect(title()).toBe('Storage and search');
    const worktrees = await screen.findByRole('region', { name: 'Worktrees' }, WAIT);
    within(worktrees).getByRole('combobox', { name: 'Suggest cleanup after' });
    expect(screen.queryByRole('region', { name: 'Secrets in saved scripts' })).toBeNull();
  });

  it('u26s-settings-iphone lists both iPhones with their state and Pair an iPhone quiet in the header', async () => {
    await mount({ id: 'u26s-settings-iphone' });

    expect(title()).toBe('iPhone');
    const mara = await screen.findByRole('group', { name: "Mara's iPhone" }, WAIT);
    expect(mara.textContent).toMatch(/Live since/);
    expect(screen.getByRole('group', { name: "Noa's iPhone" }).textContent).toMatch(
      /Offline since/,
    );
    screen.getByRole('switch', { name: 'Offer Wi-Fi' });
    expect(
      screen.getByRole('button', { name: 'Pair an iPhone' }).getAttribute('data-variant'),
    ).toBe('secondary');
  });

  it('u26s-settings-iphone-empty says what the iPhone does with one filled button', async () => {
    await mount({ id: 'u26s-settings-iphone-empty' });

    expect(await screen.findByText('See what needs you', undefined, WAIT)).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Pair an iPhone' }).getAttribute('data-variant'),
    ).toBe('primary');
    expect(screen.queryByRole('region', { name: 'Get Goodboy for iPhone' })).toBeNull();
  });

  it('u26s-settings-pair shows the code with its 60 seconds', async () => {
    await mount({ id: 'u26s-settings-pair' });

    expect(await screen.findByRole('progressbar', undefined, WAIT)).toBeDefined();
    screen.getByText('Allow it here when it asks.');
  });

  it('u26s-settings-iphone-request asks to allow with the verification code', async () => {
    await mount({ id: 'u26s-settings-iphone-request' });

    expect(await screen.findByText('An iPhone wants to pair', undefined, WAIT)).toBeDefined();
    screen.getByText(/482 913/);
    screen.getByRole('button', { name: 'Allow' });
    screen.getByRole('button', { name: 'Deny' });
  });

  it('u26s-settings-iphone-fault explains the failure with Reset pairing', async () => {
    await mount({ id: 'u26s-settings-iphone-fault' });

    expect(await screen.findByText("Pairing isn't available", undefined, WAIT)).toBeDefined();
    screen.getByRole('button', { name: 'Reset pairing' });
  });

  it.each([
    ['u26s-bar-iphone-none', 'none'],
    ['u26s-bar-iphone-live', 'live'],
    ['u26s-bar-iphone-offline', 'offline'],
    ['u26s-bar-iphone-fault', 'fault'],
  ] as const)('%s draws the top bar icon as %s', async (id, state) => {
    await mount({ id });

    await waitFor(
      () => expect(document.querySelector(`[data-iphone-entry="${state}"]`)).not.toBeNull(),
      WAIT,
    );
  });

  it('u26s-bar-iphone-open opens the compact panel', async () => {
    await mount({ id: 'u26s-bar-iphone-open' });

    const panel = await screen.findByRole('dialog', { name: 'iPhone' }, WAIT);
    expect(panel.textContent).toContain("Mara's iPhone");
    within(panel).getByRole('button', { name: /Open iPhone settings/ });
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
