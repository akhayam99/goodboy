// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    summarizerStatus: {} as Record<string, { readonly status: string }>,
    agentTurnState: {} as Record<string, { readonly kind: string }>,
    spawnReportAgent: vi.fn(async () => 'agent-report'),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { CreateReportCta } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-1'));
const RUN_ID = JSON.parse(JSON.stringify('run-1'));

const agent = ({
  id,
  status,
  workflowRunId,
}: {
  readonly id: string;
  readonly status: string;
  readonly workflowRunId?: string;
}) => ({
  id,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: id,
  status,
  ...(workflowRunId !== undefined && { workflowRunId }),
});

afterEach(cleanup);

describe('CreateReportCta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.sessionPhaseRuns = {};
    state.summarizerStatus = {};
    state.agentTurnState = {};
  });

  it('stays disabled while nothing has run', () => {
    render(<CreateReportCta sessionId={SESSION_ID} />);
    const trigger = screen.getByTestId('create-report-cta');
    expect(trigger.hasAttribute('disabled')).toBe(true);
    expect(trigger.getAttribute('title')).toContain('nothing has run yet');
  });

  it('stays disabled while an agent is still running', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [agent({ id: 'a', status: 'running' })] };
    render(<CreateReportCta sessionId={SESSION_ID} />);
    expect(screen.getByTestId('create-report-cta').hasAttribute('disabled')).toBe(true);
  });

  it('stays disabled while the source run has not stopped', () => {
    state.sessionPhaseRuns = {
      [SESSION_ID]: [
        agent({ id: 'a', status: 'running', workflowRunId: RUN_ID }),
        agent({ id: 'b', status: 'completed' }),
      ],
    };
    render(<CreateReportCta sessionId={SESSION_ID} workflowRunId={RUN_ID} />);
    expect(screen.getByTestId('create-report-cta').getAttribute('title')).toContain(
      'the run is still going',
    );
  });

  it('spawns the picked report type inline once the session is idle', async () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [agent({ id: 'a', status: 'completed' })] };
    render(<CreateReportCta sessionId={SESSION_ID} />);
    const trigger = screen.getByTestId('create-report-cta');
    expect(trigger.hasAttribute('disabled')).toBe(false);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('PR report'));
    await waitFor(() => {
      expect(state.spawnReportAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        reportType: 'pr-report',
        workflowRunId: null,
      });
    });
  });

  it('shows the failure inline instead of a dialog', async () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [agent({ id: 'a', status: 'completed' })] };
    state.spawnReportAgent.mockRejectedValueOnce(new Error('no provider connected'));
    render(<CreateReportCta sessionId={SESSION_ID} />);
    fireEvent.click(screen.getByTestId('create-report-cta'));
    fireEvent.click(screen.getByText('Session summary'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('no provider connected');
    });
  });
});
