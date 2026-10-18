// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { HomeScene, type HomeSceneState } from './HomeScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly state: HomeSceneState;
};

const mount = async ({ state }: MountParams) => {
  render(<HomeScene state={state} theme="light" />);
  await act(async () => undefined);
  expect(await screen.findByRole('heading', { level: 1, name: 'Goodboy' })).toBeDefined();
};

describe('home scenes', () => {
  it('lists the four workspaces with their folders', async () => {
    await mount({ state: 'list' });
    expect(screen.getAllByRole('button', { name: /^Open [A-Z][a-z]+( web)?$/ })).toHaveLength(4);
    expect(await screen.findByText('3 folders · ~/Code/harborline')).toBeDefined();
  });

  it('opens the one form in place', async () => {
    await mount({ state: 'new' });
    expect(screen.getByRole('form', { name: 'New workspace' })).toBeDefined();
  });

  it('says no workspace yet with setup paused at Workspace', async () => {
    await mount({ state: 'empty' });
    expect(screen.getByRole('heading', { name: 'No workspace yet' })).toBeDefined();
    expect(await screen.findByText('Setup paused at Workspace · 1 of 4 done')).toBeDefined();
  });
});
