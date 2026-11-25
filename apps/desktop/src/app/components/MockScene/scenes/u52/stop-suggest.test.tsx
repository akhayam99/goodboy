// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U52_STOP_SUGGEST_SCENES } from './stop-suggest';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ loadSetting: async () => null });
});

afterEach(cleanup);

type SceneId = keyof typeof U52_STOP_SUGGEST_SCENES;

type MountParams = {
  readonly id: SceneId;
};

const mount = async ({ id }: MountParams) => {
  const Scene = U52_STOP_SUGGEST_SCENES[id];
  render(<Scene />);
  return screen.findByRole('region', { name: 'Usual steps' });
};

describe('the stop and suggest scenes', () => {
  it('registers every scene', () => {
    expect(
      Object.keys(U52_STOP_SUGGEST_SCENES).filter((id) => MOCK_SCENES[id] === undefined),
    ).toEqual([]);
  });

  it('stopped: the first step needs you and the card offers the switch', async () => {
    await mount({ id: 'u52-stop-suggest-stopped' });

    expect(document.querySelector('[data-step-state="attention"]')).not.toBeNull();
    screen.getByRole('button', { name: 'Switch to Ship a feature' });
  });

  it('switched: the first step is skipped and no card is left', async () => {
    await mount({ id: 'u52-stop-suggest-switched' });

    expect(document.querySelector('[data-step-state="skipped"]')).not.toBeNull();
    expect(document.querySelector('[data-hold-card]')).toBeNull();
  });

  it('deviated: the added step carries its reason', async () => {
    await mount({ id: 'u52-stop-suggest-deviated' });

    screen.getByRole('button', { name: 'Why the Lead added this step' });
  });
});
