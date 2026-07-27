// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId, Step, StepId, WorkflowId } from '@goodboy/types';

vi.mock('../../../../../store', () => ({
  agentHasUnread: () => false,
  useAppStore: <T,>(selector: (state: { planConsumptions: Record<string, never[]> }) => T) =>
    selector({ planConsumptions: {} }),
  useSessionPlans: () => [],
}));

vi.mock('../../../../session/components/AgentMetricsBlock', () => ({
  AgentMetricsBlock: () => <div data-testid="metrics" />,
}));

vi.mock('./ContextWindowBar', () => ({ ContextWindowBar: () => null }));

import { WorkflowStepRow } from './WorkflowStepRow';

const step: Step = {
  id: 'step-1' as StepId,
  workflowId: 'wf-1' as WorkflowId,
  ordinal: 0,
  name: 'Scout',
  promptPrefix: 'map the area first',
  expectedOutput: 'a file map with references',
};

const agent: Agent = {
  id: 'agent-1' as AgentId,
  sessionId: 'session-1' as SessionId,
  stepId: step.id,
  ordinal: 0,
  name: 'Scout',
  status: 'completed',
  outputSummary: 'mapped 12 files',
};

type RenderParams = {
  readonly showBrief: boolean;
  readonly stepDef?: Step;
  readonly runDef?: Agent;
  readonly detailContent?: ReactNode;
};

const renderRow = ({ showBrief, stepDef = step, runDef = agent, detailContent }: RenderParams) =>
  render(
    <WorkflowStepRow
      run={runDef}
      kind="scout"
      index={0}
      step={stepDef}
      showBrief={showBrief}
      detailContent={detailContent}
      resolvedModel="claude-haiku-4-5"
      isActionable={false}
      blockReason={null}
      isSelected={false}
      isTaskActive
      isEditing={false}
      telemetry={null}
      aggregate={null}
      contextUsage={[]}
      turns={0}
      turnsLoading={false}
      onStart={vi.fn()}
      onSelect={vi.fn()}
      onRenameStart={vi.fn()}
      onRenameCommit={vi.fn()}
      onRenameCancel={vi.fn()}
    />,
  );

afterEach(cleanup);

describe('WorkflowStepRow details', () => {
  it('reveals what the step does, should produce, and produced', () => {
    renderRow({ showBrief: true });

    fireEvent.click(screen.getByRole('button', { name: /show details for scout/i }));

    expect(screen.getByText('map the area first')).toBeDefined();
    expect(screen.getByText('a file map with references')).toBeDefined();
    expect(screen.getByText('mapped 12 files')).toBeDefined();
    const brief = screen.getByText('Instructions').parentElement?.parentElement;
    expect(brief?.className).toContain('pl-4');
    expect(brief?.className).not.toContain('bg-muted');
  });

  it('keeps the details collapsed until asked', () => {
    renderRow({ showBrief: true });

    expect(screen.queryByText('map the area first')).toBeNull();
  });

  it('offers no details toggle in the sidebar variant', () => {
    renderRow({ showBrief: false });

    expect(screen.queryByRole('button', { name: /details for scout/i })).toBeNull();
  });

  it('offers no details toggle when the step carries nothing to show', () => {
    renderRow({
      showBrief: true,
      stepDef: { ...step, promptPrefix: '', expectedOutput: '' },
      runDef: { ...agent, outputSummary: undefined },
    });

    expect(screen.queryByRole('button', { name: /details for scout/i })).toBeNull();
  });

  it('strips control markers and renders markdown in what it produced', () => {
    const { container } = renderRow({
      showBrief: true,
      runDef: {
        ...agent,
        outputSummary: '<<step-done id="s1">>mapped **12** files\n\n<<ctx-goal>> confirmed',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /show details for scout/i }));

    expect(container.textContent).not.toContain('step-done');
    expect(screen.getByText('12').tagName).toBe('STRONG');
    expect(container.textContent).toContain('goal');
  });

  it('renders a pipe table in what it produced as a real table', () => {
    renderRow({
      showBrief: true,
      runDef: {
        ...agent,
        outputSummary: '| File | Action |\n| --- | --- |\n| a.ts | edited |',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /show details for scout/i }));

    expect(screen.getByRole('table')).toBeDefined();
    expect(screen.getByText('a.ts').closest('td')).not.toBeNull();
  });

  it('keeps detail content within the step row below its brief', () => {
    renderRow({
      showBrief: true,
      detailContent: <div data-testid="step-runs">Runs (1/2)</div>,
    });

    fireEvent.click(screen.getByRole('button', { name: /show details for scout/i }));

    const brief = screen.getByText('Instructions').parentElement?.parentElement;
    const runs = screen.getByTestId('step-runs');
    const card = screen.getByTestId('workflow-step-card');
    expect(brief?.compareDocumentPosition(runs) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(card.contains(brief ?? null)).toBe(true);
    expect(card.contains(runs)).toBe(true);
    expect(card.querySelectorAll('[role="separator"]')).toHaveLength(2);
  });
});
