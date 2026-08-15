// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { tintClasses } from '@goodboy/ui';
import type { Session } from '@goodboy/types';

vi.mock('./InFlightActionsStrip', () => ({
  InFlightActionsStrip: () => null,
}));

vi.mock('./PipelineSection', () => ({
  PipelineSection: () => null,
}));

vi.mock('../CreateAgentPopover', () => ({
  CreateAgentPopover: () => null,
}));

vi.mock('../../../context/components/ContextPanel/strips/PendingResolutionsStrip', () => ({
  PendingResolutionsStrip: () => null,
}));

import { ActivitySection } from './ActivitySection';

afterEach(cleanup);

const session = { id: 'sess-1', workflowRuns: [] } as unknown as Session;

const baseProps = {
  session,
  workspaceId: null,
  runs: {
    lanes: [],
    freeAgents: [],
    resolveQueue: [],
    aggregate: { runCount: 0, agentCount: 0, runningCount: 0, stalledCount: 0, spendUsd: 0 },
    blockedLanes: [],
    completedLanes: [],
    completedFreeAgents: [],
  },
  isFresh: false,
  resolveCount: 0,
  onOpenWorkflowBuilder: vi.fn(),
  onFocusCompletedRun: vi.fn(),
  onSelectLens: vi.fn(),
};

describe('ActivitySection', () => {
  it('keeps a blocked workflow on the danger tone, not the workflows concept tone', () => {
    render(
      <ActivitySection
        {...baseProps}
        runs={{ ...baseProps.runs, blockedLanes: [{ runId: 'run-1' }] as never }}
      />,
    );

    const row = screen.getByRole('button', { name: '1 blocked workflow' });
    const icon = row.querySelectorAll('svg')[0] as SVGElement;
    expect(icon.getAttribute('class')).toContain(tintClasses('danger').icon);
  });

  it('keeps active resolvers on the neutral tone, not the resolve concept tone', () => {
    render(<ActivitySection {...baseProps} resolveCount={2} />);

    const row = screen.getByRole('button', { name: '2 active resolvers' });
    const icon = row.querySelectorAll('svg')[0] as SVGElement;
    expect(icon.getAttribute('class')).toContain(tintClasses('neutral').icon);
    expect(icon.getAttribute('class')).not.toContain(tintClasses('success').icon);
  });

  it('routes a blocked-workflow click through onFocusCompletedRun and onSelectLens', () => {
    render(
      <ActivitySection
        {...baseProps}
        runs={{ ...baseProps.runs, blockedLanes: [{ runId: 'run-1' }] as never }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '1 blocked workflow' }));
    expect(baseProps.onFocusCompletedRun).toHaveBeenCalledWith('run-1');
    expect(baseProps.onSelectLens).toHaveBeenCalledWith('workflows');
  });
});
