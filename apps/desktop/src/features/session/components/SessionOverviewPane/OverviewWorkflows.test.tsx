// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

const { state, attached } = vi.hoisted(() => ({
  state: {
    sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
    setFocusedWorkflowRun: vi.fn(),
  },
  attached: {
    current: [] as ReadonlyArray<{
      run: { id: string; currentStep: number; discardedAt: string | null; goal?: string };
      workflow: { name: string; steps: ReadonlyArray<unknown> };
    }>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => attached.current,
}));

import { OverviewWorkflows } from './OverviewWorkflows';

const session = { id: 'sess-1' as SessionId, workflowRuns: [] } as unknown as Session;

beforeEach(() => {
  state.sessionProjectMounts = {};
  state.setFocusedWorkflowRun.mockClear();
  attached.current = [];
});
afterEach(cleanup);

describe('OverviewWorkflows', () => {
  it('renders the quiet attach action while no workflow is attached', () => {
    const onAttachWorkflow = vi.fn();
    render(
      <OverviewWorkflows
        session={session}
        onSelectLens={vi.fn()}
        onAttachWorkflow={onAttachWorkflow}
      />,
    );

    expect(screen.getByText('Workflows')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /attach a workflow/i }));
    expect(onAttachWorkflow).toHaveBeenCalledOnce();
  });

  it('becomes the real runs section once a workflow run exists', () => {
    attached.current = [
      {
        run: { id: 'run-1', currentStep: 0, discardedAt: null },
        workflow: { name: 'Ship it', steps: [{}, {}] },
      },
    ];
    render(
      <OverviewWorkflows session={session} onSelectLens={vi.fn()} onAttachWorkflow={vi.fn()} />,
    );

    expect(screen.getByText('Ship it')).toBeDefined();
    expect(screen.getByText('step 1 of 2')).toBeDefined();
    expect(screen.queryByRole('button', { name: /attach a workflow/i })).toBeNull();
  });
});
