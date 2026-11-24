// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { useAppStore } from '../../../../../../store';
import { MOCK_SCENES } from '../../../registry';
import { SESSION } from '../../activityRunSeed';
import { ASK_PANE_SCENES } from './ask-pane';

type SceneName = keyof typeof ASK_PANE_SCENES;

const SCENE_NAMES = Object.keys(ASK_PANE_SCENES).filter(
  (name): name is SceneName => name in ASK_PANE_SCENES,
);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('dark', 'light');
});

const mount = async (name: SceneName): Promise<HTMLElement> => {
  const Scene = ASK_PANE_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.findByRole('region', { name: 'Ask' });
};

describe('the ask pane scenes', () => {
  it('registers every scene with the mock scene registry', () => {
    for (const name of SCENE_NAMES) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it.each(SCENE_NAMES)('%s opens the Ask pane with no drawer and no Desk', async (name) => {
    await mount(name);
    expect(useAppStore.getState().drawer).toBeNull();
    expect(document.querySelector('[data-session-desk]')).toBeNull();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('shows the chips and the hint when empty, in both themes', async () => {
    const pane = await mount('ask-pane-empty-light');
    within(pane).getByRole('group', { name: 'Try asking' });
    within(pane).getByPlaceholderText('Ask about this session. Read only, it starts nothing.');
  });

  it('keeps the pane beside the Runs tab', async () => {
    const pane = await mount('ask-pane-runs');
    expect(useAppStore.getState().activeLens[SESSION.id]).toBe('workflows');
    await within(pane).findByTestId('ask-answer');
  });

  it('folds the first question of a follow up', async () => {
    const pane = await mount('ask-pane-followup');
    await within(pane).findByTestId('ask-folded-turn');
    expect(within(pane).getAllByTestId('ask-turn')).toHaveLength(1);
  });

  it('offers Stop while an answer streams', async () => {
    const pane = await mount('ask-pane-streaming');
    await within(pane).findByLabelText('Stop');
  });
});
