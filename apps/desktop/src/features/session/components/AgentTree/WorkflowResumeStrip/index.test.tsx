// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';

const { state } = vi.hoisted(() => ({
  state: {
    resumeStoppedAgents: vi.fn(async (_params: unknown) => 1),
    reportError: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { WorkflowResumeStrip } from './index';

const SESSION_ID = 'sess-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

afterEach(cleanup);

describe('WorkflowResumeStrip', () => {
  it('stays hidden when no agent was stopped by the restart', () => {
    const { container } = render(
      <WorkflowResumeStrip
        sessionId={SESSION_ID}
        runId={RUN_ID}
        agents={[
          anAgent({ status: 'stopped', stoppedBy: 'you' }),
          anAgent({ status: 'completed' }),
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('resumes every stopped agent of the run in one click', async () => {
    render(
      <WorkflowResumeStrip
        sessionId={SESSION_ID}
        runId={RUN_ID}
        agents={[
          anAgent({ id: 'a' as AgentId, status: 'stopped', stoppedBy: 'app' }),
          anAgent({ id: 'b' as AgentId, status: 'stopped', stoppedBy: 'app' }),
        ]}
      />,
    );

    expect(screen.getByText('2 agents stopped when Goodboy closed')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Resume all' }));

    await waitFor(() =>
      expect(state.resumeStoppedAgents).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        workflowRunId: RUN_ID,
      }),
    );
  });
});
