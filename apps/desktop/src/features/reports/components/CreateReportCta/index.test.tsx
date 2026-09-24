// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    openArtifactCreation: vi.fn(),
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<{ status: string }>>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { CreateReportCta } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-harborline'));
const RUN_ID = JSON.parse(JSON.stringify('run-ledger-1'));

afterEach(cleanup);

describe('CreateReportCta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.sessionPhaseRuns = {};
  });

  it('opens the creation pane instead of spawning', () => {
    render(<CreateReportCta sessionId={SESSION_ID} />);
    fireEvent.click(screen.getByTestId('create-report-cta'));
    expect(state.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'report',
      workflowRunId: null,
    });
  });

  it('carries the run it sits under into the pane', () => {
    render(<CreateReportCta sessionId={SESSION_ID} workflowRunId={RUN_ID} />);
    fireEvent.click(screen.getByTestId('create-report-cta'));
    expect(state.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'report',
      workflowRunId: RUN_ID,
    });
  });

  it('stays enabled while nothing has run', () => {
    render(<CreateReportCta sessionId={SESSION_ID} />);
    const trigger = screen.getByTestId('create-report-cta');
    expect(trigger.hasAttribute('disabled')).toBe(false);
    expect(trigger.getAttribute('title')).toBe('Write a report from what this session did');
  });

  it('hides the tile while the session has produced nothing', () => {
    render(<CreateReportCta sessionId={SESSION_ID} variant="tile" />);

    expect(screen.queryByTestId('create-report-cta')).toBeNull();
    expect(state.openArtifactCreation).not.toHaveBeenCalled();
  });

  it('opens the tile once an agent has finished', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [{ status: 'completed' }] };

    render(<CreateReportCta sessionId={SESSION_ID} variant="tile" />);

    const trigger = screen.getByTestId('create-report-cta');
    expect(trigger.hasAttribute('disabled')).toBe(false);
    fireEvent.click(trigger);
    expect(state.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'report',
      workflowRunId: null,
    });
  });
});
