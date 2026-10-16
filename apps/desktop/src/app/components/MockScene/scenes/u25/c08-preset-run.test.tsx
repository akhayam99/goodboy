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
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_C08_PRESET_RUN_SCENES } from './c08-preset-run';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_C08_PRESET_RUN_SCENES;

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
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_C08_PRESET_RUN_SCENES[name];
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

const levelOf = (): string | null =>
  document.querySelector('[data-session-rail]')?.getAttribute('data-session-rail') ?? null;

const runLevel = (): HTMLElement => {
  const layer = document.querySelector<HTMLElement>('[data-level-layer="run"]');
  if (layer === null) {
    throw new Error('no run level');
  }
  return layer;
};

const tail = (): HTMLElement => {
  const node = document.querySelector<HTMLElement>('[data-run-tail]');
  if (node === null) {
    throw new Error('no run tail');
  }
  return node;
};

describe('the c08 preset run scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U25_C08_PRESET_RUN_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('c08-runs lists the runs on one grid, grouped, with archived folded', async () => {
    await mount('c08-runs');

    expect(levelOf()).toBe('session');
    expect(document.querySelector('[data-slot="pane-meta"]')).toBeNull();
    const grid = screen.getByRole('list', { name: 'Runs' });
    expect(within(grid).getByRole('heading', { name: 'In progress' })).toBeDefined();
    expect(within(grid).getByRole('heading', { name: 'Finished' })).toBeDefined();
    expect(within(grid).getByRole('heading', { name: 'Archived' })).toBeDefined();
    expect(
      within(grid).getByRole('button', {
        name: 'Open Fix flaky tests in the ledger export, Running',
      }),
    ).toBeDefined();
    expect(
      within(grid).getByRole('button', {
        name: 'Open Document the export batching, Waits to start',
      }),
    ).toBeDefined();
    expect(within(grid).queryByText('First try at the flaky export tests')).toBeNull();
  });

  it('c08-run-working drills the sidebar into the run and embeds the running step', async () => {
    await mount('c08-run-working');

    expect(levelOf()).toBe('run');
    const level = within(runLevel());
    expect(level.getByRole('button', { name: 'Back to Runs' })).toBeDefined();
    expect(level.getByText('Fix flaky tests in the ledger export')).toBeDefined();
    expect(level.getByRole('button', { name: 'Overview' })).toBeDefined();
    expect(level.getByText('Add step')).toBeDefined();
    expect(level.getByText('Limit $3.00')).toBeDefined();
    expect(document.querySelector('[data-run-step-heading]')?.textContent).toBe(
      'Step 2 · Implementer',
    );
    expect(document.querySelector('[data-run-tail]')).toBeNull();
  });

  it('c08-run-working-other points the tail at the step that works', async () => {
    await mount('c08-run-working-other');

    expect(document.querySelector('[data-run-step-heading]')?.textContent).toBe('Step 1 · Scout');
    expect(tail().getAttribute('data-run-tail')).toBe('openStep');
    expect(within(tail()).getByText('Step 2 · Implementer is working')).toBeDefined();
    expect(within(tail()).getByRole('button', { name: 'Open step 2' })).toBeDefined();
  });

  it('c08-run-overview shows the goal and the run tail', async () => {
    await mount('c08-run-overview');

    expect(document.querySelector('[data-run-overview]')).not.toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Fix flaky tests in the ledger export' }),
    ).toBeDefined();
    expect(screen.getByText(/fail one run in five on CI/)).toBeDefined();
    expect(tail().getAttribute('data-run-tail')).toBe('openStep');
  });

  it('c08-run-ready carries Start step 3 on the tail, not in the header', async () => {
    await mount('c08-run-ready');

    expect(within(tail()).getByText('Step 2 done · ready to continue')).toBeDefined();
    expect(within(tail()).getByRole('button', { name: 'Start step 3' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Start step 3' })).toHaveLength(1);
  });

  it('c08-run-approval asks for the plan on the tail', async () => {
    await mount('c08-run-approval');

    expect(within(tail()).getByText('The plan waits for your review')).toBeDefined();
    expect(within(tail()).getByRole('button', { name: 'Approve plan' })).toBeDefined();
  });

  it('c08-run-capped offers to raise the cap on the tail and shows the foot', async () => {
    await mount('c08-run-capped');

    expect(within(tail()).getByText('Paused at the spend cap')).toBeDefined();
    expect(within(tail()).getByRole('button', { name: 'Raise spend cap' })).toBeDefined();
    expect(within(runLevel()).getByText('$3.00 spent')).toBeDefined();
  });

  it('c08-run-done offers report, wireframe and Add step', async () => {
    await mount('c08-run-done');

    expect(within(tail()).getByText('Run finished')).toBeDefined();
    expect(within(tail()).getByRole('button', { name: 'Add step' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create report' })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Create wireframe/ })).toBeDefined();
  });

  it('c08-run-archived is read only with Restore in the header', async () => {
    await mount('c08-run-archived');

    expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
    expect(within(runLevel()).queryByText('Add step')).toBeNull();
    expect(within(tail()).getByText('Archived run')).toBeDefined();
  });

  it('c08-run-menu opens the run actions with Autonomy and Skip step 2, Pause and Stop in the header', async () => {
    await mount('c08-run-menu');

    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Autonomy')).toBeDefined();
    expect(within(menu).getByText('Skip step 2')).toBeDefined();
    expect(within(menu).queryByText('Stop run')).toBeNull();
    const live = within(
      document.querySelector<HTMLElement>('[data-run-live-verbs]') ?? document.body,
    );
    expect(live.getByRole('button', { name: 'Pause run' })).toBeDefined();
    expect(live.getByRole('button', { name: 'Stop run' })).toBeDefined();
    expect(within(menu).getByText('Archive run')).toBeDefined();
  });

  it('c08-run-folded shows the run level as icons: back, Overview and one per step', async () => {
    await mount('c08-run-folded');

    expect(levelOf()).toBe('run');
    const rail = document.querySelector<HTMLElement>('[data-rail-level="run"]');
    if (rail === null) {
      throw new Error('no folded run level');
    }
    expect(within(rail).getByRole('button', { name: 'Back to Runs' })).toBeDefined();
    expect(within(rail).getByRole('button', { name: 'Overview' })).toBeDefined();
    expect(within(rail).getByRole('button', { name: 'Step 2, Implementer' })).toBeDefined();
  });

  it('c08-run-add-step opens the step draft in the center', async () => {
    await mount('c08-run-add-step');

    const overview = document.querySelector<HTMLElement>('[data-run-overview]');
    if (overview === null) {
      throw new Error('no run overview');
    }
    expect(within(overview).getByLabelText('Edit step 4')).toBeDefined();
  });
});
