// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { useAppStore } from '../../../../../store';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { OnboardingScene } from './OnboardingScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

type MountParams = {
  readonly query: string;
};

const mount = async ({ query }: MountParams): Promise<void> => {
  window.history.replaceState(null, '', `/?scene=onboarding${query}`);
  render(<OnboardingScene />);
  await act(async () => undefined);
};

const shownStep = (): string | null =>
  screen.queryByRole('dialog', { name: 'Goodboy setup' })?.getAttribute('data-step') ?? null;

const workspaceNames = (): ReadonlyArray<string> =>
  useAppStore.getState().workspaces.map((workspace) => workspace.name);

describe('onboarding scene', () => {
  it('opens on the step its id names, with no workspace before one is made', async () => {
    await mount({ query: '&step=agents' });

    await waitFor(() => expect(shownStep()).toBe('agents'));
    expect(workspaceNames()).toEqual([]);
  });

  it('takes a workspace state by name for the steps after Workspace', async () => {
    await mount({ query: '&step=tools&ws=folder' });

    await waitFor(() => expect(shownStep()).toBe('tools'));
    expect(workspaceNames()).toEqual(['Acme docs']);
  });

  it('seeds the agents state it names', async () => {
    await mount({ query: '&step=agents&agents=none' });

    const connected = useAppStore
      .getState()
      .providers.filter((provider) => provider.connection === 'connected');
    expect(connected).toEqual([]);
  });

  it('falls back to Welcome on an old numbered step', async () => {
    await mount({ query: '&step=1' });

    await waitFor(() => expect(shownStep()).toBe('welcome'));
  });
});
