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
  CreateAgentPopover: () => <button type="button">Start agent</button>,
}));

import { OverviewActions } from './index';

const SESSION_ID: SessionId = JSON.parse(JSON.stringify('session-1'));

beforeEach(() => {
  vi.clearAllMocks();
  state.sessionPhaseRuns = {};
});

afterEach(cleanup);

describe('OverviewActions', () => {
  it('puts one Start agent split in the header with the other starts in its menu', () => {
    render(<OverviewActions sessionId={SESSION_ID} onOpenWorkflowBuilder={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Start agent' })).toBeDefined();
    for (const name of ['Add workflow', 'Create report', 'Create wireframe']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    fireEvent.click(screen.getByRole('button', { name: 'More ways to start' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.querySelector('.font-medium')?.textContent)).toEqual([
      'Workflow',
      'Report',
      'Wireframe',
    ]);
    expect(
      items.every((item) => item.textContent !== item.querySelector('.font-medium')?.textContent),
    ).toBe(true);
  });

  it('opens the workflow builder from the Workflow item', () => {
    const onOpenWorkflowBuilder = vi.fn();
    render(
      <OverviewActions sessionId={SESSION_ID} onOpenWorkflowBuilder={onOpenWorkflowBuilder} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'More ways to start' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Workflow/ }));

    expect(onOpenWorkflowBuilder).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it.each([
    ['Report', 'report'],
    ['Wireframe', 'wireframe'],
  ] as const)('opens the %s creation from its item', (label, kind) => {
    render(<OverviewActions sessionId={SESSION_ID} onOpenWorkflowBuilder={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'More ways to start' }));
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${label}`) }));

    expect(state.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind,
      workflowRunId: null,
    });
  });

  it('keeps all four starts on the kickoff tiles', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [{ status: 'completed' }] };
    render(
      <OverviewActions sessionId={SESSION_ID} variant="tile" onOpenWorkflowBuilder={vi.fn()} />,
    );
    for (const name of ['Start agent', 'Add workflow', 'Create report', 'Create wireframe']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeDefined();
    }
  });

  it('holds the report tile back until the session has something to report', () => {
    render(
      <OverviewActions sessionId={SESSION_ID} variant="tile" onOpenWorkflowBuilder={vi.fn()} />,
    );

    expect(screen.queryByTestId('create-report-cta')).toBeNull();
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
    expect(descriptions.length).toBe(2);
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
