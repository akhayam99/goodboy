// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  DYNAMIC_RUN_ID,
  FLOW_SESSION_ID,
} from '../../../../../app/components/MockScene/scenes/flow-audit/fixtures';
import { seedRecentBackfillOutput } from '../../../../../app/components/MockScene/scenes/flow-audit/runControl';
import { seedWorkflowRunPlanHoldDynamic } from '../../../../../app/components/MockScene/scenes/flow-audit/planHoldRun';
import { seedWorkflowRun } from '../../../../../app/components/MockScene/scenes/flow-audit/seeds';
import { WorkflowRunDetail } from './WorkflowRunDetail';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ attachment_read: 'iVBORw0KGgo=' });
});

afterEach(cleanup);

const Harness = () => {
  const session = useAppStore((state) =>
    state.sessions.find((candidate) => candidate.id === FLOW_SESSION_ID),
  );
  const run = session?.workflowRuns.find((candidate) => candidate.id === DYNAMIC_RUN_ID);
  const workflow = useAppStore((state) =>
    state.sessionWorkflows[FLOW_SESSION_ID]?.find((candidate) => candidate.id === run?.workflowId),
  );
  if (session === undefined || run === undefined || workflow === undefined) {
    return null;
  }
  return <WorkflowRunDetail session={session} run={run} workflow={workflow} />;
};

const renderPage = () =>
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

const seedLive = (): void => {
  seedWorkflowRun();
  seedRecentBackfillOutput();
};

const stopNames = (): ReadonlyArray<string> =>
  screen
    .queryAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
    .filter((name) => /^Stop\b/.test(name));

describe('WorkflowRunDetail on a live run', () => {
  it('draws the run title once, in the header, above the steps', async () => {
    seedLive();
    renderPage();

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading.closest('[data-slot="pane-header"]')).not.toBeNull();
    const steps = screen.getByTestId('run-tree');
    expect(heading.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves no chevron that navigates back to the other runs', async () => {
    seedLive();
    renderPage();

    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Show run summary' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Expand .* run$/ })).toBeNull();
    expect(useAppStore.getState().focusedWorkflowRunId[FLOW_SESSION_ID]).toBe(DYNAMIC_RUN_ID);
  });

  it('names Stop run in the header and Stop step in the status line', async () => {
    seedLive();
    renderPage();

    const strip = await screen.findByTestId('orchestrator-strip');
    expect(stopNames()).toEqual(['Stop run', 'Stop step']);
    expect(within(strip).getByRole('button', { name: 'Stop step' })).toBeDefined();
    expect(within(strip).queryByRole('button', { name: 'Stop run' })).toBeNull();
  });

  it('keeps the status line free of buttons that belong to the header', async () => {
    seedLive();
    renderPage();

    const strip = await screen.findByTestId('orchestrator-strip');
    expect(strip.querySelectorAll('[data-variant="primary"]')).toHaveLength(0);
    expect(within(strip).queryByRole('button', { name: 'Orchestrator actions' })).toBeNull();
    expect(within(strip).queryByRole('button', { name: /plan$/ })).toBeNull();
  });

  it('draws one menu trigger on the whole run page', async () => {
    seedLive();
    renderPage();

    await screen.findByTestId('orchestrator-strip');
    expect(screen.getAllByRole('button', { name: /run actions$/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /run controls$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plan actions' })).toBeNull();
  });
});

describe('WorkflowRunDetail on a dynamic run held for its plan', () => {
  it('offers the plan once, as Review plan in the header, and nowhere else', async () => {
    seedWorkflowRunPlanHoldDynamic();
    renderPage();

    const strip = await screen.findByTestId('orchestrator-strip');
    expect(strip.getAttribute('data-phase')).toBe('plan-approval');
    const entries = screen.queryAllByRole('button', { name: /^(Review|Open|Approve) plan$/ });
    expect(entries.map((entry) => entry.textContent)).toEqual(['Review plan']);
    expect(screen.getByTestId('run-header').contains(entries[0] ?? null)).toBe(true);
  });
});
