// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26S_PALETTE_SCENES } from './PaletteGroupsScene';

const SETTLE_MS = 1_000;

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

type SceneId = keyof typeof U26S_PALETTE_SCENES;

const mount = async ({ id }: { readonly id: SceneId }): Promise<void> => {
  const Scene = U26S_PALETTE_SCENES[id];
  render(<Scene />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

describe('the secondary palette scenes', () => {
  it('registers every scene for the capture', () => {
    Object.entries(U26S_PALETTE_SCENES).forEach(([id, Scene]) =>
      expect(MOCK_SCENES[id]).toBe(Scene),
    );
  });

  it('u26s-palette-empty groups the list as Go to, Create, App, Help', async () => {
    await mount({ id: 'u26s-palette-empty' });

    const list = screen.getByRole('listbox', { name: 'Commands' });
    const titles = Array.from(list.querySelectorAll('li[role="presentation"]')).map(
      (item) => item.textContent,
    );
    expect(titles).toEqual(expect.arrayContaining(['Go to', 'Create', 'App', 'Help']));
    expect(titles.indexOf('Go to')).toBeLessThan(titles.indexOf('Create'));
    expect(titles.indexOf('Create')).toBeLessThan(titles.indexOf('App'));
    expect(titles.indexOf('App')).toBeLessThan(titles.indexOf('Help'));
  });

  it('u26s-palette-pair finds Pair an iPhone by its old words', async () => {
    await mount({ id: 'u26s-palette-pair' });

    expect(
      within(screen.getByRole('listbox', { name: 'Commands' })).getByRole('option', {
        name: /^Pair an iPhone/,
      }),
    ).toBeDefined();
  });

  it('u26s-palette-guide lists the Guide chapters once typed', async () => {
    await mount({ id: 'u26s-palette-guide' });

    expect(
      within(screen.getByRole('listbox', { name: 'Commands' })).getByRole('option', {
        name: /^Guide: Commits/,
      }),
    ).toBeDefined();
  });
});
