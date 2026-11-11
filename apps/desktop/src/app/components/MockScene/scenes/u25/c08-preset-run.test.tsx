// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { requestSessionSpendLimitEdit } from '../../../../../features/budget/requestSessionSpendLimitEdit';
import { C08_SESSION_ID } from './c08RunSeed';
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

const runPanel = (): HTMLElement => {
  const panel = document.querySelector<HTMLElement>('[data-spawned-panel="run"]');
  if (panel === null) {
    throw new Error('no Agents panel on the run');
  }
  return panel;
};

const header = (): HTMLElement => {
  const node = document.querySelector<HTMLElement>('[data-run-header-actions]');
  if (node === null) {
    throw new Error('The run page has no header actions');
  }
  return node;
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

  it('c08-runs lists the runs on one grid, grouped, without archived runs', async () => {
    await mount('c08-runs');

    expect(levelOf()).toBe('session');
    expect(document.querySelector('[data-slot="pane-meta"]')).toBeNull();
    const grid = screen.getByRole('list', { name: 'Runs' });
    expect(within(grid).getByRole('heading', { name: 'Running' })).toBeDefined();
    within(grid).getByRole('heading', { name: 'Idle' });
    expect(within(grid).getByRole('heading', { name: 'Finished' })).toBeDefined();
    expect(within(grid).queryByRole('heading', { name: 'Archived' })).toBeNull();
    expect(
      within(grid).getByRole('button', {
        name: 'Open Fix flaky tests in the ledger export, Workflow, Running',
      }),
    ).toBeDefined();
    expect(
      within(grid).getByRole('button', {
        name: 'Open Document the export batching, Workflow, Ready',
      }),
    ).toBeDefined();
    expect(within(grid).queryByText('First try at the flaky export tests')).toBeNull();
  });

  it('c08-run-working keeps the rail on the session, shows the run in the Agents panel and embeds the running step', async () => {
    await mount('c08-run-working');

    expect(levelOf()).toBe('session');
    const panel = within(runPanel());
    expect(panel.queryByRole('button', { name: 'Back to Runs' })).toBeNull();
    expect(panel.getByText('Fix flaky tests in the ledger export')).toBeDefined();
    expect(panel.getByRole('tree', { name: 'Run agents' })).toBeDefined();
    expect(panel.queryByText('Add step')).toBeNull();
    expect(document.querySelector('[data-run-spend-foot]')).toBeNull();
    expect(document.querySelector('[data-run-step-heading]')?.textContent).toMatch(
      /^Step 2 · Implementer/,
    );
    expect(document.querySelector('[data-run-tail]')).toBeNull();
    const line = document.querySelector<HTMLElement>('[data-dock-live]');
    if (line === null) {
      throw new Error('no live line');
    }
    within(line).getByRole('button', { name: 'Stop this reply' });
    expect(line.textContent).toContain('running step 2');
  });

  it('c08-run-working-other points the tail at the step that works', async () => {
    await mount('c08-run-working-other');

    expect(document.querySelector('[data-run-step-heading]')?.textContent).toMatch(
      /^Step 1 · Scout/,
    );
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

  it('u35-preset-run-glance draws one glance line with the run spend once and Run settings', async () => {
    await mount('u35-preset-run-glance');

    const glance = document.querySelector<HTMLElement>('[data-glance]');
    expect(glance).not.toBeNull();
    expect(glance?.textContent?.match(/\$/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(
      within(glance ?? document.body).getByRole('button', { name: 'Run settings' }),
    ).toBeDefined();
    expect(document.querySelectorAll('[data-glance]')).toHaveLength(1);
  });

  it('c08-run-ready says the step is done and keeps Start step 3 on one quiet line', async () => {
    await mount('c08-run-ready');

    expect(within(tail()).getByText('Step 2 done')).toBeDefined();
    within(tail()).getByRole('button', { name: 'Start step 3' });
    expect(screen.getAllByRole('button', { name: 'Start step 3' })).toHaveLength(1);
    expect(document.querySelector('[data-run-header-actions]')).toBeNull();
  });

  it('c08-run-approval says the plan waits and asks for it on the quiet line of the step', async () => {
    await mount('c08-run-approval');

    expect(within(tail()).getByText('The plan needs approval')).toBeDefined();
    expect(
      within(tail()).getByRole('button', { name: 'Approve and start Fix the batching' }),
    ).toBeDefined();
  });

  it('c08-run-capped says it paused at the limit and offers to raise it on the quiet line', async () => {
    await mount('c08-run-capped');

    expect(within(tail()).getByText('Paused at the limit')).toBeDefined();
    within(tail()).getByRole('button', { name: 'Raise limit' });
  });

  it('c08-run-capped opens the session limit editor for a session cap on the run page', async () => {
    await mount('c08-run-capped');

    await act(async () => {
      requestSessionSpendLimitEdit({ sessionId: C08_SESSION_ID });
      await vi.advanceTimersByTimeAsync(100);
      await new Promise((resolve) => {
        requestAnimationFrame(() => resolve(null));
      });
    });

    const dialog = screen.getByRole('dialog', { name: 'Session spend' });
    expect(within(dialog).getByLabelText('Limit in dollars')).toBeDefined();
  });

  it('c08-run-done hides Settings and the tail, keeps Add step and offers the outcome', async () => {
    await mount('c08-run-done');

    expect(document.querySelector('[data-run-tail]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Run settings' })).toBeNull();
    const overview = document.querySelector<HTMLElement>('[data-run-overview]');
    within(overview ?? document.body).getByRole('button', { name: 'Add step' });
    expect(within(runPanel()).queryByText('Add step')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create report' })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Create wireframe/ })).toBeDefined();
  });

  it('c08-run-archived is read only with Restore in the header', async () => {
    await mount('c08-run-archived');

    expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add step' })).toBeNull();
    expect(document.querySelector('[data-run-tail]')).toBeNull();
  });

  it('c08-run-menu holds Skip step 2 and Stop run, Asks you sits on its chip, Pause run alone in the header', async () => {
    await mount('c08-run-menu');

    const menu = screen.getByRole('menu');
    expect(within(menu).queryByText('Asks you')).toBeNull();
    expect(within(menu).getByText('Stop run')).toBeDefined();
    const live = within(
      document.querySelector<HTMLElement>('[data-run-live-verbs]') ?? document.body,
    );
    expect(live.getByRole('button', { name: 'Pause run' })).toBeDefined();
    expect(live.queryByRole('button', { name: 'Stop run' })).toBeNull();
    expect(within(menu).getByText('Archive run')).toBeDefined();
  });

  it('c08-run-folded folds the rail on the session and keeps one tree row per step in the panel', async () => {
    await mount('c08-run-folded');

    expect(levelOf()).toBe('session');
    expect(document.querySelector('[data-rail-level="run"]')).toBeNull();
    const tree = within(runPanel()).getByRole('tree', { name: 'Run agents' });
    expect(within(tree).getAllByRole('treeitem').length).toBeGreaterThan(1);
    expect(within(tree).getByRole('treeitem', { name: /Implementer/ })).toBeDefined();
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
