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

const runDock = (): HTMLElement => {
  const foot = document.querySelector<HTMLElement>('[data-run-spend-foot]');
  if (foot === null) {
    throw new Error('no run foot');
  }
  return foot;
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
        name: 'Open Fix flaky tests in the ledger export, Plan, Running',
      }),
    ).toBeDefined();
    expect(
      within(grid).getByRole('button', {
        name: 'Open Document the export batching, Plan, Waits to start',
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
    expect(panel.getByText('Add step')).toBeDefined();
    expect(within(runDock()).getByText('Limit $3.00')).toBeDefined();
    expect(document.querySelector('[data-run-step-heading]')?.textContent).toBe(
      'Step 2 · Implementer',
    );
    expect(document.querySelector('[data-run-tail]')).toBeNull();
    const conversationTail = document.querySelector<HTMLElement>('[data-conversation-tail]');
    if (conversationTail === null) {
      throw new Error('no conversation tail');
    }
    expect(within(conversationTail).getByRole('button', { name: 'Stop step 2' })).toBeDefined();
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

  it('c08-run-capped offers to raise the limit on the tail and shows the foot', async () => {
    await mount('c08-run-capped');

    expect(within(tail()).getByText('Paused at the limit')).toBeDefined();
    expect(within(tail()).getByRole('button', { name: 'Raise limit' })).toBeDefined();
    expect(within(runDock()).getByText('$3.00 spent')).toBeDefined();
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

  it('c08-run-done offers report and wireframe, and leaves Add step to the Agents panel', async () => {
    await mount('c08-run-done');

    expect(within(tail()).getByText('Run finished')).toBeDefined();
    expect(within(tail()).queryByRole('button')).toBeNull();
    expect(within(runPanel()).getByText('Add step')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create report' })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Create wireframe/ })).toBeDefined();
  });

  it('c08-run-archived is read only with Restore in the header', async () => {
    await mount('c08-run-archived');

    expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
    expect(within(runPanel()).queryByText('Add step')).toBeNull();
    expect(document.querySelector('[data-run-tail]')).toBeNull();
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
