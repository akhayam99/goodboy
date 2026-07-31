// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, SessionId, WorkflowId, WorkflowRun, WorkflowRunId } from '@goodboy/types';

const { storeState } = vi.hoisted(() => ({
  storeState: {} as Record<string, unknown>,
}));

vi.mock('../../../../store/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
}));

import { OrchestratorPanel } from './index';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

const run = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN_ID,
  workflowId: 'workflow-1' as WorkflowId,
  ordinal: 0,
  currentStep: 0,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  ...overrides,
});

beforeEach(() => {
  Object.assign(storeState, {
    orchestrateNextStep: vi.fn(async () => undefined),
    retryWorkflowOrchestration: vi.fn(async () => undefined),
    continueWorkflowRun: vi.fn(async () => undefined),
    setWorkflowOrchestratorHints: vi.fn(async () => undefined),
    setWorkflowOrchestratorRouting: vi.fn(async () => undefined),
    sessions: [],
    workspaceOverrides: {},
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'missing' },
    ],
  });
});

afterEach(cleanup);

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];

describe('OrchestratorPanel', () => {
  it('says what the orchestrator is doing while it decides', () => {
    render(
      <OrchestratorPanel
        sessionId={SESSION_ID}
        run={run()}
        agents={EMPTY_AGENTS}
        isOrchestrating
      />,
    );
    expect(screen.getByTestId('orchestrator-panel').textContent).toContain(
      'deciding the next step',
    );
  });

  it('shows the failure and offers a retry', () => {
    render(
      <OrchestratorPanel
        sessionId={SESSION_ID}
        run={run({ orchestrationError: 'usage limit reached (anthropic/haiku-4.5)' })}
        agents={EMPTY_AGENTS}
        isOrchestrating={false}
      />,
    );
    expect(screen.getByTestId('orchestrator-error').textContent).toContain('usage limit reached');
    fireEvent.click(screen.getByTestId('orchestrator-retry'));
    expect(storeState['retryWorkflowOrchestration']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('keeps a completed run extendable with a note', () => {
    render(
      <OrchestratorPanel
        sessionId={SESSION_ID}
        run={run({ orchestrationOutcome: 'done' })}
        agents={EMPTY_AGENTS}
        isOrchestrating={false}
      />,
    );
    fireEvent.click(screen.getByTestId('orchestrator-continue-toggle'));
    fireEvent.change(screen.getByTestId('orchestrator-continue-note'), {
      target: { value: 'tests are missing' },
    });
    fireEvent.click(screen.getByTestId('orchestrator-continue-confirm'));
    expect(storeState['continueWorkflowRun']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      'tests are missing',
    );
  });

  it('saves runtime hints', () => {
    render(
      <OrchestratorPanel
        sessionId={SESSION_ID}
        run={run()}
        agents={EMPTY_AGENTS}
        isOrchestrating={false}
      />,
    );
    fireEvent.click(screen.getByTestId('orchestrator-hints-toggle'));
    fireEvent.change(screen.getByTestId('orchestrator-hints-input'), {
      target: { value: 'ignore the website' },
    });
    fireEvent.click(screen.getByTestId('orchestrator-hints-save'));
    expect(storeState['setWorkflowOrchestratorHints']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      'ignore the website',
    );
  });

  it('asks the orchestrator for the next step while the run sits idle', () => {
    render(
      <OrchestratorPanel
        sessionId={SESSION_ID}
        run={run()}
        agents={EMPTY_AGENTS}
        isOrchestrating={false}
      />,
    );

    fireEvent.click(screen.getByTestId('workflow-orchestrate-next-cta'));

    expect(storeState['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('drops the next step control once the run is complete', () => {
    render(
      <OrchestratorPanel
        sessionId={SESSION_ID}
        run={run({ orchestrationOutcome: 'done' })}
        agents={EMPTY_AGENTS}
        isOrchestrating={false}
      />,
    );

    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
    expect(screen.getByTestId('orchestrator-continue-toggle')).toBeDefined();
  });
});
