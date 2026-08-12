import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';

const announce = vi.fn();
const state: { activeLens: Record<string, string>; selectedAgentId: Record<string, string> } = {
  activeLens: {},
  selectedAgentId: {},
};

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign(vi.fn(), { getState: () => state }),
}));

vi.mock('../../../../shared/hooks/useAgentStartedToast', () => ({
  useAgentStartedToast: () => announce,
}));

import { WorkflowFollowToastBridge } from './';

const SESSION_ID = 'sess-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

const fireStepStarted = () => {
  window.dispatchEvent(
    new CustomEvent('goodboy:workflow-step-started', {
      detail: { sessionId: SESSION_ID, agentId: AGENT_ID, stepName: 'Implement' },
    }),
  );
};

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
    render(<WorkflowFollowToastBridge />);
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

  it('stays quiet while the operator already watches the workflows lens', () => {
    state.activeLens = { [SESSION_ID]: 'workflows' };
    render(<WorkflowFollowToastBridge />);
    fireStepStarted();
    expect(announce).not.toHaveBeenCalled();
  });

  it('stays quiet when that agent is already selected', () => {
    state.activeLens = { [SESSION_ID]: 'agents' };
    state.selectedAgentId = { [SESSION_ID]: AGENT_ID };
    render(<WorkflowFollowToastBridge />);
    fireStepStarted();
    expect(announce).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const view = render(<WorkflowFollowToastBridge />);
    view.unmount();
    fireStepStarted();
    expect(announce).not.toHaveBeenCalled();
  });
});
