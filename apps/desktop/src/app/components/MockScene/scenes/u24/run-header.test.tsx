// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_RUN_HEADER_SCENES } from './run-header';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
});

const SCENE_IDS = [
  'run-header-held',
  'run-header-paused',
  'run-header-failed',
  'run-header-archived',
] as const;

const PRIMARY_OF = {
  'run-header-held': 'Review plan',
  'run-header-paused': 'Resume',
  'run-header-failed': 'Retry',
  'run-header-archived': 'Restore',
} as const satisfies Record<(typeof SCENE_IDS)[number], string>;

const renderScene = (id: (typeof SCENE_IDS)[number]) => {
  const Scene = U24_RUN_HEADER_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const header = async (): Promise<HTMLElement> => screen.findByTestId('run-header');

describe('the run header scenes', () => {
  it('registers exactly the four scenes the plan names, in the scene list', () => {
    expect(Object.keys(U24_RUN_HEADER_SCENES).sort()).toEqual([...SCENE_IDS].sort());
    for (const id of SCENE_IDS) {
      expect(MOCK_SCENES[id]).toBe(U24_RUN_HEADER_SCENES[id]);
    }
  });

  it.each(SCENE_IDS)('draws one h1 and one primary in %s', async (id) => {
    renderScene(id);

    const bar = await header();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const primaries = Array.from(bar.querySelectorAll('button[data-variant="primary"]'));
    expect(primaries.map((button) => button.textContent)).toEqual([PRIMARY_OF[id]]);
  });

  it.each(SCENE_IDS)('draws at most one menu trigger of the run in %s', async (id) => {
    renderScene(id);

    const bar = await header();
    expect(within(bar).getAllByRole('button', { name: /run actions$/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Show run summary' })).toBeNull();
  });

  it('offers the plan once on the held run, in the header and nowhere else', async () => {
    renderScene('run-header-held');

    const bar = await header();
    const entries = screen.queryAllByRole('button', { name: /^(Review|Open|Approve) plan$/ });
    expect(entries.map((entry) => entry.textContent)).toEqual(['Review plan']);
    expect(bar.contains(entries[0] ?? null)).toBe(true);
  });

  it('offers Stop run on the paused and failed runs, and none on the archived run', async () => {
    renderScene('run-header-paused');
    expect(within(await header()).getByRole('button', { name: 'Stop run' })).toBeDefined();
    cleanup();

    renderScene('run-header-failed');
    expect(within(await header()).getByRole('button', { name: 'Stop run' })).toBeDefined();
    cleanup();

    renderScene('run-header-archived');
    expect(within(await header()).queryByRole('button', { name: 'Stop run' })).toBeNull();
  });
});
