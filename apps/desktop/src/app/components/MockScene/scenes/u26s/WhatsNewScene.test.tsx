// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26S_WHATS_NEW_SCENES } from './WhatsNewScene';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U26S_WHATS_NEW_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U26S_WHATS_NEW_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the secondary What is new scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26S_WHATS_NEW_SCENES).sort()).toEqual([
      'u26s-whatsnew-release',
      'u26s-whatsnew-search',
    ]);
    expect(MOCK_SCENES['u26s-whatsnew-release']).toBe(
      U26S_WHATS_NEW_SCENES['u26s-whatsnew-release'],
    );
  });

  it('u26s-whatsnew-release dates the rows and heads the reader with its meta', async () => {
    mount({ id: 'u26s-whatsnew-release' });

    const rail = await screen.findByRole('navigation', { name: 'Releases' }, WAIT);

    await waitFor(() => expect(within(rail).getAllByText(/Installed/).length).toBe(1), WAIT);
    expect(screen.getByRole('searchbox', { name: 'Search releases' })).toBeDefined();
  });
});
