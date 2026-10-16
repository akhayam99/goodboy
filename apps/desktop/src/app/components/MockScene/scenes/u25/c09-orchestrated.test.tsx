// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_C09_ORCHESTRATED_SCENES } from './c09-orchestrated';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_C09_ORCHESTRATED_SCENES;

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
  const Scene = U25_C09_ORCHESTRATED_SCENES[name];
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

const nodeOf = (selector: string): HTMLElement => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node === null) {
    throw new Error(`no ${selector}`);
  }
  return node;
};

const tail = (): HTMLElement => nodeOf('[data-orchestrated-tail]');

const checklist = (): HTMLElement => nodeOf('section[aria-label="Plan and progress"]');

const currentPage = (): string | null =>
  document.querySelector('[data-testid="session-pages"] [aria-current="page"]')?.textContent ??
  null;

describe('the c09 orchestrated scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U25_C09_ORCHESTRATED_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('c09-orchestrated-list lists only orchestrated runs on the run grid', async () => {
    await mount('c09-orchestrated-list');

    expect(document.querySelector('[data-slot="pane-meta"]')).toBeNull();

    expect(currentPage()).toBe('Orchestrated1');
    const grid = screen.getByRole('list', { name: 'Orchestrated' });
    expect(
      within(grid).getByRole('button', { name: /^Open Speed up the export end to end/ }),
    ).toBeDefined();
    expect(within(grid).queryByText('Fix flaky tests in the ledger export')).toBeNull();
  });

  it('c09-orchestrated-empty offers Orchestrate with the one line', async () => {
    await mount('c09-orchestrated-empty');

    expect(screen.getByText('No orchestrated runs yet')).toBeDefined();
    expect(screen.getByText('The orchestrator picks each next step from your goal.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Orchestrate' })).toBeDefined();
  });

  it('c09-orch-running reads as one document with the sidebar on Orchestrated', async () => {
    await mount('c09-orch-running');

    expect(currentPage()).toBe('Orchestrated1');
    expect(screen.getByRole('heading', { name: 'Speed up the export end to end' })).toBeDefined();
    expect(screen.getByText(/times out over 10k rows/)).toBeDefined();
    const facts = nodeOf('[data-orchestrated-facts]');
    const autonomy = within(facts).getByRole('button', { name: 'Autonomy: Balanced' });
    expect(autonomy.textContent).toBe('AutonomyBalanced');
    act(() => {
      autonomy.click();
    });
    const autonomyMenu = screen.getByRole('menu', { name: 'Autonomy' });
    expect(
      within(autonomyMenu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual(['Ask me', 'Balanced', 'Autopilot']);
    act(() => {
      autonomy.click();
    });
    expect(facts.textContent).toContain('Can use Claude, Codex');
    expect(facts.textContent).toContain('Limit $3.00');
    const rows = within(checklist());
    expect(rows.getByText('Step 3')).toBeDefined();
    expect(rows.getByText('Run the 12k export benchmark')).toBeDefined();
    expect(rows.getByText('Time the export five times')).toBeDefined();
    expect(rows.getByText('Your hint, read at step 3')).toBeDefined();
    const planned = [...checklist().querySelectorAll<HTMLElement>('[data-plan-row="left"]')];
    expect(
      planned.map((row) => row.querySelector('[data-checklist-cell="role"]')?.textContent ?? null),
    ).toEqual(['Tester', 'Implementer']);
    expect(planned.map((row) => row.textContent)).toEqual([
      'TesterProve the batching on 12,000 rows',
      'ImplementerStream rows to CSV',
    ]);
    expect(tail().getAttribute('data-orchestrated-tail')).toBe('waiting');
    expect(within(tail()).getByText(/^Waiting on step 3/)).toBeDefined();
    expect(within(tail()).getByRole('button', { name: 'Stop step 3' })).toBeDefined();
    expect(
      within(tail()).getByText(
        'Why: The batching must be proven on 12,000 rows before any CSV work.',
      ),
    ).toBeDefined();
    const queued = screen.getByRole('list', { name: 'Queued hints' });
    expect(screen.getAllByText('Waits for the next decision')).toHaveLength(1);
    expect(within(queued).queryByText('Waits for the next decision')).toBeNull();
    expect(within(queued).getByRole('button', { name: 'Remove' })).toBeDefined();
    expect(screen.getByPlaceholderText('Hint the orchestrator')).toBeDefined();
    const dock = nodeOf('[data-slot="pane-dock"]');
    expect(dock.getAttribute('data-dock-edge')).toBe('space');
    expect(dock.previousElementSibling?.getAttribute('role') ?? null).not.toBe('separator');
    expect(screen.queryByTestId('orchestrator-strip')).toBeNull();
  });

  it('c09-orch-step opens the step in the pane, the latest reason stays under the tail only', async () => {
    await mount('c09-orch-step');

    expect(screen.getByText('Step 3 · Tester')).toBeDefined();
    expect(document.querySelector('[data-step-reason]')).toBeNull();
    expect(
      screen.getByText('Why: The batching must be proven on 12,000 rows before any CSV work.', {
        selector: '[data-orchestrated-reason]',
      }),
    ).toBeDefined();
    const pane = nodeOf('[data-run-step-pane]');
    fireEvent.click(within(pane).getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Open full' })).toBeDefined();
    expect(screen.queryByPlaceholderText(/^Message/)).toBeNull();
    expect(screen.getByPlaceholderText('Hint the orchestrator')).toBeDefined();
    expect(tail().getAttribute('data-orchestrated-tail')).toBe('waiting');
  });

  it('c09-orch-reading shows the hint being read and the next step not decided', async () => {
    await mount('c09-orch-reading');

    expect(tail().getAttribute('data-orchestrated-tail')).toBe('deciding');
    expect(within(tail()).getByText('Choosing the next step')).toBeDefined();
    expect(within(checklist()).getByText('Next step, not decided yet')).toBeDefined();
    const queued = screen.getByRole('list', { name: 'Queued hints' });
    expect(within(queued).getByText('Reading now')).toBeDefined();
    expect(within(queued).getByRole('button', { name: 'Remove' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('c09-orch-ready waits for your go with Decide next step on the tail', async () => {
    await mount('c09-orch-ready');

    expect(within(tail()).getByText('Waiting for your go')).toBeDefined();
    expect(within(tail()).getByRole('button', { name: 'Decide next step' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Decide next step' })).toHaveLength(1);
  });

  it('c09-orch-failed says why and offers Retry and View transcript', async () => {
    await mount('c09-orch-failed');

    expect(
      within(tail()).getByText('Last decision failed: the orchestrator returned no step.'),
    ).toBeDefined();
    expect(within(tail()).getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(within(tail()).getByRole('button', { name: 'View transcript' })).toBeDefined();
  });

  it('c09-orch-done shows the result with Done, Left and the next moves', async () => {
    await mount('c09-orch-done');

    expect(within(tail()).getByText('Run complete')).toBeDefined();
    expect(screen.queryByPlaceholderText('Hint the orchestrator')).toBeNull();
    const result = nodeOf('[data-orchestrated-result]');
    expect(within(result).getByText(/export takes 4.1s on 12,000 rows/)).toBeDefined();
    expect(within(result).getByRole('list', { name: 'Done' })).toBeDefined();
    expect(within(result).getByText('Stream rows to CSV, a follow up')).toBeDefined();
    expect(within(result).getByRole('button', { name: 'Create report' })).toBeDefined();
    expect(within(result).getByRole('button', { name: 'Add step' })).toBeDefined();
    expect(within(checklist()).getByText('Your hint, read at step 4')).toBeDefined();
    expect(within(checklist()).queryByText('Stream rows to CSV, a follow up')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Queued hints' })).toBeNull();
  });

  it('c09-orch-archived is read only with Restore and no composer', async () => {
    await mount('c09-orch-archived');

    expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
    expect(document.querySelector('[data-orchestrated-tail]')).toBeNull();
    expect(screen.queryByPlaceholderText('Hint the orchestrator')).toBeNull();
  });

  it('c09-orch-menu holds the run verbs, with Step routing and Skip step 3, Pause and Stop in the header', async () => {
    await mount('c09-orch-menu');

    const menu = screen.getByRole('menu');
    expect(within(menu).queryByText('Autonomy')).toBeNull();
    expect(within(menu).getByText('Step routing')).toBeDefined();
    expect(within(menu).getByText('Skip step 3')).toBeDefined();
    expect(within(menu).getByText('Copy run summary')).toBeDefined();
    expect(within(menu).queryByText('Pause run')).toBeNull();
    const live = within(
      document.querySelector<HTMLElement>('[data-run-live-verbs]') ?? document.body,
    );
    expect(live.getByRole('button', { name: 'Pause run' })).toBeDefined();
    expect(live.getByRole('button', { name: 'Stop run' })).toBeDefined();
    expect(within(menu).getByText('Archive run')).toBeDefined();
    expect(within(menu).getByText('Delete run')).toBeDefined();
  });
  it('c09-orch-guidance shows the process and the standing guidance under Hide guidance', async () => {
    await mount('c09-orch-guidance');

    const goal = nodeOf('section[aria-label="Goal"]');
    expect(within(goal).getByRole('button', { name: 'Hide guidance' })).toBeDefined();
    expect(within(goal).getAllByText(/Measure before and after every change/)).toHaveLength(1);
    expect(within(goal).getAllByText(/behind the existing export flag/)).toHaveLength(1);
  });

  it('c09-orch-guidance-once shows guidance the builder saved twice only once', async () => {
    await mount('c09-orch-guidance-once');

    const goal = nodeOf('section[aria-label="Goal"]');
    expect(within(goal).getByRole('button', { name: 'Hide guidance' })).toBeDefined();
    expect(within(goal).getAllByText(/behind the existing export flag/)).toHaveLength(1);
  });
});
