// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { LEFT_SIDEBAR_MIN, LEFT_SIDEBAR_STORAGE_KEY } from '@goodboy/ui';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26S_UPDATE_CARD_SCENES } from './UpdateCardScene';

const SETTLE_MS = 2_000;

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
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U26S_UPDATE_CARD_SCENES;

const SCENE_IDS: ReadonlyArray<SceneId> = [
  'u26s-update-available',
  'u26s-update-ready',
  'u26s-update-running',
  'u26s-update-failed',
  'u26s-update-row',
  'u26s-update-settings',
];

type MountParams = {
  readonly id: SceneId;
};

const mount = async ({ id }: MountParams): Promise<Element> => {
  const Scene = U26S_UPDATE_CARD_SCENES[id];
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

type CardParams = {
  readonly name: string;
};

const verbsOfCard = ({ name }: CardParams): ReadonlyArray<string | null> =>
  within(screen.getByRole('dialog', { name }))
    .getAllByRole('button')
    .map((button) => button.textContent);

type OnPageParams = {
  readonly elements: ReadonlyArray<HTMLElement>;
};

const onPage = ({ elements }: OnPageParams): ReadonlyArray<HTMLElement> =>
  elements.filter((element) => element.closest('[role="dialog"]') === null);

const pill = (): HTMLElement => {
  const element = document.querySelector<HTMLElement>('[data-update-pill]');
  if (element === null) {
    throw new Error('the Goodboy row has no update pill');
  }
  return element;
};

describe('the update card scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26S_UPDATE_CARD_SCENES).sort()).toEqual([...SCENE_IDS].sort());
    Object.entries(U26S_UPDATE_CARD_SCENES).forEach(([id, Scene]) =>
      expect(MOCK_SCENES[id]).toBe(Scene),
    );
  });

  it('u26s-update-available opens the card from the pill with Update now', async () => {
    await mount({ id: 'u26s-update-available' });

    expect(verbsOfCard({ name: 'Goodboy 0.27.2 is available' })).toEqual([
      'Later',
      "What's new",
      'Update now',
    ]);
  });

  it('u26s-update-ready shows the card on arrival with Restart now', async () => {
    await mount({ id: 'u26s-update-ready' });

    expect(verbsOfCard({ name: 'Goodboy 0.27.2 is ready' })).toEqual([
      'Later',
      "What's new",
      'Restart now',
    ]);
  });

  it('u26s-update-running names the two agents and waits for them on request', async () => {
    await mount({ id: 'u26s-update-running' });

    expect(verbsOfCard({ name: '2 agents are running' })).toEqual([
      'Later',
      'Restart now',
      'Restart when they finish',
    ]);
  });

  it('u26s-update-failed says nothing changed and offers Retry', async () => {
    await mount({ id: 'u26s-update-failed' });

    expect(verbsOfCard({ name: 'Goodboy 0.27.2 did not install' })).toEqual(['Later', 'Retry']);
    screen.getByText('The download was cut off at 61%.');
  });

  it('u26s-update-row draws the pill in the Goodboy row at the narrowest sidebar', async () => {
    await mount({ id: 'u26s-update-row' });

    expect(window.localStorage.getItem(LEFT_SIDEBAR_STORAGE_KEY)).toBe(String(LEFT_SIDEBAR_MIN));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(pill().textContent).toBe('0.27.2');
    expect(pill().getAttribute('aria-label')).toBe('Goodboy 0.27.2 is available');
    const row = pill().closest('[data-column-foot]');
    expect(row?.contains(screen.getByTestId('goodboy-chip')) ?? false).toBe(true);
  });

  it('u26s-update-settings puts the same verbs on Settings, Updates', async () => {
    await mount({ id: 'u26s-update-settings' });

    expect(screen.getByRole('heading', { level: 1, name: 'Updates' })).toBeDefined();
    screen.getByText('Goodboy 0.27.2 is ready');
    screen.getByText('2 agents are running. A restart now picks them up where they stopped.');
    for (const name of ['Restart now', 'Restart when they finish']) {
      expect(onPage({ elements: screen.getAllByRole('button', { name }) })).toHaveLength(1);
    }
    screen.getByRole('button', { name: "Open What's new" });
  });

  it.each(SCENE_IDS)('%s has no accessibility violation once drawn', async (id) => {
    const container = await mount({ id });
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
