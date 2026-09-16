// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    openArtifactCreation: vi.fn(),
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<{ status: string }>>,
  },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../CreateAgentPopover', () => ({
  CreateAgentPopover: () => <button type="button">New agent</button>,
}));

import { OverviewActions } from './index';

const SESSION_ID: SessionId = JSON.parse(JSON.stringify('session-1'));

beforeEach(() => {
  vi.clearAllMocks();
  state.sessionPhaseRuns = {};
});

afterEach(cleanup);

describe('OverviewActions', () => {
  it('keeps workflow and agent creation permanently mounted in the activity header', () => {
    const onOpenWorkflowBuilder = vi.fn();
    render(
      <OverviewActions sessionId={SESSION_ID} onOpenWorkflowBuilder={onOpenWorkflowBuilder} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add workflow' }));
    expect(screen.getByRole('button', { name: 'New agent' })).toBeDefined();
    expect(onOpenWorkflowBuilder).toHaveBeenCalledOnce();
  });

  it('offers the same four actions in both variants', () => {
    const compact = render(
      <OverviewActions sessionId={SESSION_ID} onOpenWorkflowBuilder={vi.fn()} />,
    );
    const compactNames = ['New agent', 'Add workflow', 'Create report', 'Create wireframe'];
    for (const name of compactNames) {
      expect(screen.getByRole('button', { name })).toBeDefined();
    }
    compact.unmount();

    render(
      <OverviewActions sessionId={SESSION_ID} variant="tile" onOpenWorkflowBuilder={vi.fn()} />,
    );
    for (const name of compactNames) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeDefined();
    }
  });

  it('keeps the report tile visible and explains why it cannot be taken yet', () => {
    render(
      <OverviewActions sessionId={SESSION_ID} variant="tile" onOpenWorkflowBuilder={vi.fn()} />,
    );

    expect(screen.getByTestId('create-report-cta').hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText('nothing has run yet, so there is nothing to work from.'),
    ).toBeDefined();
    expect(screen.getByTestId('create-wireframe-cta').hasAttribute('disabled')).toBe(false);
  });

  it('releases both artifact tiles once an agent has finished', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [{ status: 'completed' }] };

    render(
      <OverviewActions sessionId={SESSION_ID} variant="tile" onOpenWorkflowBuilder={vi.fn()} />,
    );

    expect(screen.getByTestId('create-report-cta').hasAttribute('disabled')).toBe(false);
    expect(screen.getByTestId('create-wireframe-cta').hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByTestId('create-report-cta'));
    expect(state.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'report',
      workflowRunId: null,
    });
  });

  it('ends every tile description on one convention', () => {
    const { container } = render(
      <OverviewActions sessionId={SESSION_ID} variant="tile" onOpenWorkflowBuilder={vi.fn()} />,
    );

    const descriptions = [...container.querySelectorAll('.line-clamp-2')].map(
      (node) => node.textContent ?? '',
    );
    expect(descriptions.length).toBe(3);
    for (const description of descriptions) {
      expect(description.endsWith('.')).toBe(true);
    }
    expect(descriptions).toContain('Draw the screen or flow you describe.');
  });

  it('opens the workflow builder from the tile', () => {
    const onOpenWorkflowBuilder = vi.fn();
    render(
      <OverviewActions
        sessionId={SESSION_ID}
        variant="tile"
        onOpenWorkflowBuilder={onOpenWorkflowBuilder}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Add workflow/ }));
    expect(onOpenWorkflowBuilder).toHaveBeenCalledOnce();
  });
});
