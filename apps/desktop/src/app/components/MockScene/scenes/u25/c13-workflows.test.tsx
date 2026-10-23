// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock({
    listRemovedSeededWorkflowIds: async () => [],
  }),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { MOCK_SCENES } from '../..';
import { U25_C13_WORKFLOWS_SCENES } from './c13-workflows';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const settle = (ms = 150): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, ms)));

const renderScene = async (name: keyof typeof U25_C13_WORKFLOWS_SCENES): Promise<void> => {
  const Scene = U25_C13_WORKFLOWS_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle(600);
};

const pane = (): HTMLElement => screen.getByRole('region', { name: 'Fix flaky tests' });

describe('c13 workflows scenes', () => {
  it('registers every state', () => {
    for (const [id, scene] of Object.entries(U25_C13_WORKFLOWS_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('lists the workflows on one grid with their origin, steps and runs', async () => {
    await renderScene('c13-workflows');

    const grid = screen.getByRole('list', { name: 'Workflows' });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(4);
    expect(within(grid).getByRole('button', { name: 'Open Fix a bug' }).textContent).toContain(
      'Built in',
    );
    expect(within(grid).getByRole('button', { name: 'Open Refactor' }).textContent).toContain(
      'Edited',
    );
    expect(
      within(grid).getByRole('button', {
        name: /^Runs of Fix flaky tests: last run 4m ago, 3 runs$/,
      }),
    ).toBeDefined();
    expect(
      within(grid).getByRole('button', { name: 'Runs of Lint and type check: none yet' })
        .textContent,
    ).toBe('No runs');
    expect(screen.queryByRole('region', { name: 'Fix flaky tests' })).toBeNull();
  });

  it('opens the runs of a workflow newest first, each named by its session', async () => {
    await renderScene('c13-workflows-history');

    expect(within(pane()).queryByText('3 runs')).toBeNull();
    const runs = within(pane()).getByRole('list', { name: 'Runs of Fix flaky tests' });
    const rows = within(runs).getAllByRole('button');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Open the run in Ledger export speed up',
      'Open the run in Nightly reconciliation before cutoff',
      'Open the run in Acme refund idempotency',
    ]);
    expect(rows[0]?.textContent).not.toContain('Running');
    expect(rows[0]?.textContent).toContain('$0.71');
    expect(within(rows[0] ?? pane()).getByRole('img', { name: 'Running' })).toBeDefined();
    expect(within(rows[2] ?? pane()).getByRole('img', { name: 'Failed' })).toBeDefined();
  });

  it('opens the run in its session from a history row', async () => {
    const navigate = vi.fn();
    store.setState({ navigate });
    await renderScene('c13-workflows-history');

    fireEvent.click(
      within(pane()).getByRole('button', { name: 'Open the run in Ledger export speed up' }),
    );

    expect(navigate).toHaveBeenCalledWith({
      to: {
        at: 'session',
        sessionId: 'mock-c13-session-flaky-ledger',
        view: {
          lens: 'workflows',
          agentId: null,
          target: { kind: 'run', runId: 'mock-c13-run-flaky-ledger' },
        },
      },
    });
  });

  it('closes the pane from its close button and opens the editor from Open workflow', async () => {
    await renderScene('c13-workflows-history');

    fireEvent.click(within(pane()).getByRole('button', { name: 'Close runs' }));
    await settle();
    expect(screen.queryByRole('region', { name: 'Fix flaky tests' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Runs of Fix flaky tests/ }));
    await settle();
    fireEvent.click(within(pane()).getByRole('button', { name: 'Open workflow' }));
    await settle();
    expect(screen.queryByRole('list', { name: 'Workflows' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Fix flaky tests' })).toBeNull();
  });

  it('offers a first run for a workflow never run, opening the preset form on it', async () => {
    const openSessionDraft = vi.fn();
    store.setState({ openSessionDraft });
    await renderScene('c13-workflows-history-empty');

    const empty = screen.getByRole('region', { name: 'Lint and type check' });
    expect(within(empty).getByText('No runs yet')).toBeDefined();
    fireEvent.click(within(empty).getByRole('button', { name: 'Start from this preset' }));

    expect(openSessionDraft).toHaveBeenCalledOnce();
    const workspaceId = store.getState().currentWorkspaceId;
    const draft = workspaceId === null ? null : store.getState().sessionDrafts[workspaceId];
    const presets =
      workspaceId === null ? [] : (store.getState().phaseTemplates[workspaceId] ?? []);
    const preset = presets.find((workflow) => workflow.name === 'Lint and type check');
    expect(draft).toMatchObject({
      startKind: 'workflow',
      startShape: 'preset',
      workflowId: preset?.id,
    });
  });

  it('says the runs could not load and retries on Retry', async () => {
    await renderScene('c13-workflows-history-failed');
    const loadWorkflowRunHistory = vi.fn(async () => undefined);
    act(() => store.setState({ loadWorkflowRunHistory }));

    expect(within(pane()).getByRole('alert').textContent).toContain("Couldn't load runs");
    expect(within(pane()).queryByRole('list')).toBeNull();
    fireEvent.click(within(pane()).getByRole('button', { name: 'Retry' }));

    expect(loadWorkflowRunHistory).toHaveBeenCalledWith({
      workspaceId: 'mock-c13-workspace-harborline',
    });
  });

  it('filters a long history to running or failed runs', async () => {
    await renderScene('c13-workflows-history-filter');

    const history = screen.getByRole('region', { name: 'Fix a bug' });
    const list = () => within(history).getByRole('list', { name: 'Runs of Fix a bug' });
    expect(within(list()).getAllByRole('button')).toHaveLength(12);
    fireEvent.click(within(history).getByRole('tab', { name: 'Failed' }));
    expect(within(list()).getAllByRole('button')).toHaveLength(2);
    fireEvent.click(within(history).getByRole('tab', { name: 'Running' }));
    expect(within(list()).getAllByRole('button')).toHaveLength(1);
  });
});
