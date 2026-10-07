// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { OrchestratorDock } from './OrchestratorDock';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;

const storeState: Record<string, unknown> = {};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const run = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  ...overrides,
});

const agent = (status: Agent['status']): Agent => ({
  id: 'agent-0' as AgentId,
  sessionId: SESSION_ID,
  stepId: 'step-0' as StepId,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'step 0',
  status,
});

type RenderParams = {
  readonly runOverride?: WorkflowRun;
  readonly agents?: ReadonlyArray<Agent>;
  readonly isOrchestrating?: boolean;
};

const renderDock = ({
  runOverride = run(),
  agents = [],
  isOrchestrating = false,
}: RenderParams = {}) => {
  useAppStore.setState({
    ...(storeState as Partial<AppStore>),
    orchestratingWorkflowRuns: { [RUN_ID]: isOrchestrating },
  });
  return render(<OrchestratorDock sessionId={SESSION_ID} run={runOverride} agents={agents} />);
};

const type = (value: string): HTMLInputElement => {
  const input = screen.getByTestId('orchestrator-hint-input') as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  return input;
};

const tooltipOf = async (name: string): Promise<string> => {
  const button = screen.getByRole('button', { name });
  fireEvent.mouseEnter(button.parentElement as HTMLElement);
  const tooltip = await screen.findByRole('tooltip', {}, { timeout: 2_000 });
  return tooltip.textContent ?? '';
};

beforeEach(async () => {
  await resetStoryStore();
  Object.assign(storeState, {
    addWorkflowOrchestratorHint: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
  });
});

afterEach(cleanup);

describe('OrchestratorDock', () => {
  it('queues a hint from the field', () => {
    renderDock();

    type('ignore the website');
    fireEvent.click(screen.getByTestId('orchestrator-hint-queue'));

    expect(storeState['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      text: 'ignore the website',
      delivery: 'queue',
    });
  });

  it('sends a hint to be read now', () => {
    renderDock();

    type('look at the payout domain first');
    fireEvent.click(screen.getByTestId('orchestrator-hint-now'));

    expect(storeState['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      text: 'look at the payout domain first',
      delivery: 'now',
    });
  });

  it('keeps hint delivery open while the orchestrator is deciding', () => {
    renderDock({ isOrchestrating: true });

    const input = type('skip the visual suite');
    expect(input.hasAttribute('disabled')).toBe(false);
    expect(screen.getByTestId('orchestrator-hint-queue').hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByTestId('orchestrator-hint-now'));

    expect(storeState['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      text: 'skip the visual suite',
      delivery: 'now',
    });
  });

  it('clears the field as soon as a hint is sent, keeping the focus there', () => {
    storeState['addWorkflowOrchestratorHint'] = vi.fn(() => new Promise(() => undefined));
    renderDock();

    const input = type('ignore the website');
    fireEvent.click(screen.getByTestId('orchestrator-hint-queue'));

    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('puts the text back and reports it when the hint could not be saved', async () => {
    storeState['addWorkflowOrchestratorHint'] = vi.fn(async () => {
      throw new Error('disk full');
    });
    renderDock();

    const input = type('ignore the website');
    fireEvent.click(screen.getByTestId('orchestrator-hint-now'));

    expect(input.value).toBe('');
    await waitFor(() => expect(input.value).toBe('ignore the website'));
    expect(storeState['reportError']).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't save the hint", sessionId: SESSION_ID }),
    );
  });

  it('carries no help sentence under the field, only a tooltip on each button', async () => {
    renderDock();

    expect(screen.queryByTestId('orchestrator-hint-timing')).toBeNull();
    expect(screen.queryByText(/Queue waits for the next decision/)).toBeNull();
    type('one more thing');
    expect(await tooltipOf('Queue')).toBe('Queue waits for the next decision.');
  });

  it('says what Read now does in the state the run is in, in its tooltip', async () => {
    renderDock();
    type('a');
    expect(await tooltipOf('Read now')).toBe('Read now asks for a decision right away.');

    cleanup();
    renderDock({ agents: [agent('running')] });
    type('a');
    expect(await tooltipOf('Read now')).toBe(
      'Read now stops the step in flight, keeps what it wrote, and decides again.',
    );

    cleanup();
    renderDock({ isOrchestrating: true });
    type('a');
    expect(await tooltipOf('Read now')).toBe('Read now restarts this one with your hint.');

    cleanup();
    renderDock({
      runOverride: run({ orchestrationStop: { kind: 'paused', message: 'paused' } }),
      agents: [agent('running')],
    });
    type('a');
    expect(await tooltipOf('Read now')).toBe(
      'While the run is paused, Read now waits in the queue too.',
    );
  });
});
