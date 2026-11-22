// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U50_FLEET_ROWS_SCENES } from './fleetRows';

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
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
});

type SceneParams = {
  readonly name: string;
};

type ScopeParams = {
  readonly scope: HTMLElement;
};

const MOUNTED_TITLE = 'Nightly reconciliation before the Monday close';
const MOUNTLESS_TITLE = 'Speed up the payout export for large merchants';

const renderScene = ({ name }: SceneParams) => {
  const Scene = U50_FLEET_ROWS_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`No scene ${name}`);
  }
  render(<Scene />);
};

const phraseIn = ({ scope }: ScopeParams): string =>
  scope.querySelector('[data-fleet-phrase]')?.textContent ?? '';

const boardCardOf = async ({ name }: SceneParams): Promise<HTMLElement> => {
  const lanes = await screen.findAllByRole('button', { name });
  const card = lanes.map((button) => button.closest('article')).find((found) => found !== null);
  if (card === undefined || card === null) {
    throw new Error(`No board card for ${name}`);
  }
  return card;
};

describe('the u50 fleet rows scenes', () => {
  it('lists the scene in light and dark', () => {
    expect(Object.keys(U50_FLEET_ROWS_SCENES)).toEqual([
      'u50-fleet-rows-light',
      'u50-fleet-rows-dark',
    ]);
  });

  it('says the same phrase on the board card, in Sessions and in the Now chip', async () => {
    renderScene({ name: 'u50-fleet-rows-light' });
    const card = await boardCardOf({ name: MOUNTED_TITLE });
    await within(card).findByText(/^Running pnpm test reconcile in /);
    const onCard = phraseIn({ scope: card });

    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    const sessions = await screen.findByRole('dialog', { name: 'Sessions' });
    const sessionsRow = within(sessions)
      .getAllByRole('option')
      .find((row) => row.textContent?.includes(MOUNTED_TITLE) === true);
    expect(sessionsRow === undefined ? '' : phraseIn({ scope: sessionsRow })).toBe(onCard);
    fireEvent.keyDown(sessions, { key: 'Escape', code: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: /sessions running/ }));
    const now = await screen.findByRole('dialog', { name: 'Now' });
    const nowRow = within(now)
      .getAllByRole('button')
      .find((row) => row.textContent?.includes(MOUNTED_TITLE) === true);
    expect(nowRow === undefined ? '' : phraseIn({ scope: nowRow })).toBe(onCard);
  });

  it('names no project for an agent without a mount', async () => {
    renderScene({ name: 'u50-fleet-rows-dark' });
    const card = await boardCardOf({ name: MOUNTLESS_TITLE });

    await within(card).findByText('Running pnpm build export');
    expect(phraseIn({ scope: card })).not.toMatch(/ in /);
  });

  it('draws the phrase as still text', async () => {
    renderScene({ name: 'u50-fleet-rows-light' });
    const card = await boardCardOf({ name: MOUNTED_TITLE });
    const phrase = await within(card).findByText(/^Running pnpm test reconcile/);

    expect(phrase.children).toHaveLength(0);
    expect(phrase.closest('[aria-live]')).toBeNull();
  });
});
