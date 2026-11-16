// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U44_RUNS_SCENES } from './runs';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U44_RUNS_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<HTMLElement> => {
  const Scene = U44_RUNS_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return screen.getByRole('list', { name: 'Runs' });
};

type RowParams = {
  readonly grid: HTMLElement;
  readonly title: string;
};

const rowText = ({ grid, title }: RowParams): string =>
  within(grid)
    .getAllByRole('listitem')
    .find((item) => (item.textContent ?? '').includes(title))?.textContent ?? '';

describe('the u44 Runs scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U44_RUNS_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('u44-runs-list names who leads each run, and keeps the older run on its own line', async () => {
    const grid = await mount('u44-runs-list');

    expect(
      within(grid)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Needs you', 'Running', 'Idle', 'Finished']);
    expect(rowText({ grid, title: 'Stop retried webhooks' })).toContain(
      'Lead · plan Fix flaky tests',
    );
    expect(rowText({ grid, title: 'Batch the ledger export' })).toContain('Lead');
    const older = rowText({ grid, title: 'Fix flaky tests in the ledger export' });
    expect(older).toContain('Workflow · Orchestrated');
    expect(older).toContain('older run');
    expect(rowText({ grid, title: 'Replay the failed webhooks' })).toContain('Agent · Implementer');
    expect(screen.queryByRole('textbox', { name: 'Start a run' })).toBeNull();
  });

  it('u44-runs-start-open opens the field above the list with the ask typed', async () => {
    await mount('u44-runs-start-open');

    const field = screen.getByRole('textbox', { name: 'Start a run' });
    expect(field).toHaveProperty(
      'value',
      'Make the ledger export retry safe when the bank times out',
    );
    screen.getByRole('list', { name: 'Runs' });
  });
});
