// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { SESSION_ID } from '../activityRunSeed';
import { U25_README_HERO_SCENES } from './readme-hero';

const SETTLE_MS = 2_000;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (): Promise<void> => {
  const Scene = U25_README_HERO_SCENES['readme-hero'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

describe('readme hero scene', () => {
  it('registers the scene with the mock scene registry', () => {
    expect(MOCK_SCENES['readme-hero']).toBeDefined();
  });

  it('opens the session with its projects, the shared context and runs on three providers', async () => {
    await mount();

    const rail = screen.getByRole('navigation', { name: 'Session' });
    const projects = within(rail).getByRole('group', { name: 'Folders' });
    const labels = [...projects.querySelectorAll('[data-worktree-entries] [data-entry-label]')].map(
      (label) => label.textContent ?? '',
    );
    expect(labels).toEqual(['Pull request', 'Comments', 'Files', 'Checks']);
    expect(within(rail).getByRole('group', { name: 'Linked' })).toBeDefined();
    expect(useAppStore.getState().drawer?.kind).toBe('context');

    const agents = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const providers = new Set(agents.map((agent) => agent.providerOverride));
    expect([...providers].sort()).toEqual(['anthropic', 'codex', 'cursor']);
    expect(agents.some((agent) => agent.modelOverride === 'claude-haiku-4-5')).toBe(false);
  });
});
