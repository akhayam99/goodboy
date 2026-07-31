// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId, Session, WorkflowRunId } from '@goodboy/types';

const { selectAgent } = vi.hoisted(() => ({ selectAgent: vi.fn(async () => undefined) }));

type AgentsSectionMockProps = {
  readonly inspectedStepId: AgentId | null;
  readonly onInspectStep: (agentId: AgentId) => void;
};

type InspectorMockProps = {
  readonly agentId: AgentId;
  readonly onClose: () => void;
  readonly onOpenChat: () => void;
};

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector({ selectAgent }),
}));

vi.mock('@goodboy/ui', () => ({
  ResizeHandle: () => <div role="separator" />,
  ScrollFade: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection', () => ({
  AgentsSection: ({ inspectedStepId, onInspectStep }: AgentsSectionMockProps) => (
    <button type="button" data-inspected={inspectedStepId} onClick={() => onInspectStep(STEP_ID)}>
      pick step
    </button>
  ),
}));

vi.mock('../../../../workflows/components/WorkflowStepInspector', () => ({
  WorkflowStepInspector: ({ agentId, onClose, onOpenChat }: InspectorMockProps) => (
    <div data-testid="step-inspector" data-agent-id={agentId}>
      <button type="button" onClick={onOpenChat}>
        open chat
      </button>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

import { WorkflowRunDetail } from './WorkflowRunDetail';

const SESSION_ID = 'session-1';
const STEP_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as WorkflowRunId;

const session = { id: SESSION_ID } as unknown as Session;

afterEach(() => {
  selectAgent.mockClear();
  cleanup();
});

describe('WorkflowRunDetail', () => {
  it('opens the step detail beside the run and keeps the chat one click away', () => {
    render(<WorkflowRunDetail session={session} workflowRunId={RUN_ID} />);

    expect(screen.queryByTestId('step-inspector')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'pick step' }));

    expect(screen.getByTestId('step-inspector').getAttribute('data-agent-id')).toBe(STEP_ID);

    fireEvent.click(screen.getByRole('button', { name: 'open chat' }));

    expect(selectAgent).toHaveBeenCalledWith(SESSION_ID, STEP_ID);
  });

  it('closes the step detail without leaving the run', () => {
    render(<WorkflowRunDetail session={session} workflowRunId={RUN_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick step' }));
    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(screen.queryByTestId('step-inspector')).toBeNull();
    expect(screen.getByRole('button', { name: 'pick step' })).toBeDefined();
  });
});
