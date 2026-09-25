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
    for (const name of ['Start a workflow', 'Create report', 'Create wireframe']) {
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
});
