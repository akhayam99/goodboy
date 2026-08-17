import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import type { WorkflowGeneration } from '../../../../store/slices/workflowStudio/types';

const announce = vi.fn();
const state = {
  activeLens: {},
  selectedAgentId: {},
  workflowGenerations: {} as Record<string, WorkflowGeneration>,
  visibleWorkflowStudioWorkspaceId: null,
};

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign((selector: (value: typeof state) => unknown) => selector(state), {
    getState: () => state,
  }),
}));

vi.mock('../../../../shared/hooks/useAgentStartedToast', () => ({
  useAgentStartedToast: () => announce,
}));

import { WorkflowFollowToastBridge } from './';
import { ToastProvider } from '../../../../app/components/Toast';

const SESSION_ID = 'sess-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

const fireStepStarted = () => {
  window.dispatchEvent(
    new CustomEvent('goodboy:workflow-step-started', {
      detail: { sessionId: SESSION_ID, agentId: AGENT_ID, stepName: 'Implement' },
    }),
  );
};

const renderBridge = () =>
  render(
    <ToastProvider>
      <WorkflowFollowToastBridge />
    </ToastProvider>,
  );

describe('WorkflowFollowToastBridge', () => {
  beforeEach(() => {
    announce.mockClear();
    state.activeLens = {};
    state.selectedAgentId = {};
  });

  afterEach(() => {
    cleanup();
  });

  it('offers to follow the step that just started', () => {
    renderBridge();
    fireStepStarted();
    expect(announce).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      title: 'Implement started',
      message: 'The workflow moved on to the next step.',
      actionLabel: 'Follow',
      lens: 'workflows',
    });
  });

  it('toasts when generation finishes outside the studio', () => {
    const open = vi.fn();
    window.addEventListener('goodboy:open-workflow-studio', open);
    state.workflowGenerations = {
      'workspace-1': {
        status: 'complete',
        workspaceId: 'workspace-1' as never,
        workflowId: 'workflow-1' as never,
        notificationId: 'notice-1',
        undoSnapshot: null,
      },
    };

    renderBridge();
    expect(screen.getByText('Your workflow is ready.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(open).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-workflow-studio', open);
  });

  it('stays quiet while the operator already watches the workflows lens', () => {
    state.activeLens = { [SESSION_ID]: 'workflows' };
    renderBridge();
    fireStepStarted();
    expect(announce).not.toHaveBeenCalled();
  });

  it('stays quiet when that agent is already selected', () => {
    state.activeLens = { [SESSION_ID]: 'agents' };
    state.selectedAgentId = { [SESSION_ID]: AGENT_ID };
    renderBridge();
    fireStepStarted();
    expect(announce).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const view = renderBridge();
    view.unmount();
    fireStepStarted();
    expect(announce).not.toHaveBeenCalled();
  });
});
