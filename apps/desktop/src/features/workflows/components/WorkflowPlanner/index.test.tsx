// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Workflow } from '@goodboy/types';

const { mockSavePhaseTemplate, mockPlan } = vi.hoisted(() => ({
  mockSavePhaseTemplate: vi.fn(async (_workflow: Workflow) => undefined),
  mockPlan: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: { savePhaseTemplate: (workflow: Workflow) => Promise<void> }) => T,
  ) => selector({ savePhaseTemplate: mockSavePhaseTemplate }),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...original,
    PlannerClient: vi.fn().mockImplementation(() => ({ plan: mockPlan })),
  };
});

import { WorkflowPlanner } from './index';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const PLAN_FIXTURE = {
  workflowName: 'Test Workflow',
  reasoning: 'test reasoning',
  steps: [
    { name: 'scout', role: 'scout', promptPrefix: 'scout prefix', expectedOutput: 'scout output' },
    {
      name: 'implementer',
      role: 'implementer',
      promptPrefix: 'eng prefix',
      expectedOutput: 'eng output',
    },
  ],
};

async function planAndSave(process = 'do something') {
  mockPlan.mockResolvedValue({ output: PLAN_FIXTURE });
  render(
    <WorkflowPlanner
      workspaceId={'ws-1' as never}
      providerId="anthropic"
      initialProcess={process}
      onWorkflowReady={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
  await waitFor(() => screen.getByText('Test Workflow'));
  fireEvent.click(screen.getByRole('button', { name: /use this workflow/i }));
  await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
  return mockSavePhaseTemplate.mock.calls[0]![0] as Workflow;
}

describe('WorkflowPlanner', () => {
  it('renders the planner with a Generate plan button disabled until a process is typed', () => {
    render(
      <WorkflowPlanner
        workspaceId={'ws-1' as never}
        providerId="anthropic"
        initialProcess=""
        onWorkflowReady={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /generate plan/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('mentions the provider hint in the footer', () => {
    render(
      <WorkflowPlanner
        workspaceId={'ws-1' as never}
        providerId="anthropic"
        initialProcess=""
        onWorkflowReady={vi.fn()}
      />,
    );
    expect(screen.getByText(/cheap-tier · anthropic/i)).toBeDefined();
  });

  describe('onSave — role persistence', () => {
    it('persists the planner-assigned role on each step', async () => {
      const saved = await planAndSave();
      expect(saved.steps[0]!.role).toBe('scout');
      expect(saved.steps[1]!.role).toBe('implementer');
    });

    it('preserves ordinal order matching planner output', async () => {
      const saved = await planAndSave();
      expect(saved.steps[0]!.ordinal).toBe(0);
      expect(saved.steps[1]!.ordinal).toBe(1);
    });

    it('preserves name and promptPrefix from planner output', async () => {
      const saved = await planAndSave();
      expect(saved.steps[0]!.name).toBe('scout');
      expect(saved.steps[0]!.promptPrefix).toBe('scout prefix');
    });

    it('role is unchanged even when model defaults differ across steps', async () => {
      mockPlan.mockResolvedValue({
        output: {
          workflowName: 'Multi-role',
          reasoning: '',
          steps: [
            { name: 'planner', role: 'architect', promptPrefix: '', expectedOutput: '' },
            { name: 'coder', role: 'implementer', promptPrefix: '', expectedOutput: '' },
            { name: 'qa', role: 'tester', promptPrefix: '', expectedOutput: '' },
          ],
        },
      });
      render(
        <WorkflowPlanner
          workspaceId={'ws-2' as never}
          providerId="anthropic"
          initialProcess="multi role"
          onWorkflowReady={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
      await waitFor(() => screen.getByText('Multi-role'));
      fireEvent.click(screen.getByRole('button', { name: /use this workflow/i }));
      await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
      const saved = mockSavePhaseTemplate.mock.calls[0]![0] as Workflow;
      const roles = saved.steps.map((s) => s.role);
      expect(roles).toEqual(['architect', 'implementer', 'tester']);
    });

    it('saves a role even for steps whose name would resolve to a different kind by regex', async () => {
      mockPlan.mockResolvedValue({
        output: {
          workflowName: 'Misleading name',
          reasoning: '',
          steps: [
            {
              name: 'planner agent',
              role: 'implementer',
              promptPrefix: '',
              expectedOutput: '',
            },
          ],
        },
      });
      render(
        <WorkflowPlanner
          workspaceId={'ws-3' as never}
          providerId="anthropic"
          initialProcess="misleading"
          onWorkflowReady={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
      await waitFor(() => screen.getByText('Misleading name'));
      fireEvent.click(screen.getByRole('button', { name: /use this workflow/i }));
      await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
      const saved = mockSavePhaseTemplate.mock.calls[0]![0] as Workflow;
      expect(saved.steps[0]!.role).toBe('implementer');
    });

    it('calls onWorkflowReady with the generated workflowId on save', async () => {
      mockPlan.mockResolvedValue({ output: PLAN_FIXTURE });
      const onWorkflowReady = vi.fn();
      render(
        <WorkflowPlanner
          workspaceId={'ws-4' as never}
          providerId="anthropic"
          initialProcess="test"
          onWorkflowReady={onWorkflowReady}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
      await waitFor(() => screen.getByText('Test Workflow'));
      fireEvent.click(screen.getByRole('button', { name: /use this workflow/i }));
      await waitFor(() => expect(onWorkflowReady).toHaveBeenCalledOnce());
      const [workflowId] = onWorkflowReady.mock.calls[0]!;
      expect(typeof workflowId).toBe('string');
      expect(workflowId).toMatch(/^wf_planner_/);
    });

    it('workflowId on saved workflow matches the id passed to onWorkflowReady', async () => {
      const saved = await planAndSave();
      const workflowId = mockSavePhaseTemplate.mock.calls[0]![0].id;
      expect(saved.steps.every((s) => s.workflowId === workflowId)).toBe(true);
    });

    it('re-plan resets role back to fresh planner output on second save', async () => {
      mockPlan.mockResolvedValueOnce({ output: PLAN_FIXTURE }).mockResolvedValueOnce({
        output: {
          workflowName: 'Second Plan',
          reasoning: '',
          steps: [{ name: 'debugger', role: 'investigator', promptPrefix: '', expectedOutput: '' }],
        },
      });
      render(
        <WorkflowPlanner
          workspaceId={'ws-5' as never}
          providerId="anthropic"
          initialProcess="re-plan test"
          onWorkflowReady={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
      await waitFor(() => screen.getByText('Test Workflow'));
      fireEvent.click(screen.getByRole('button', { name: /re-plan/i }));
      await waitFor(() => screen.getByText('Second Plan'));
      fireEvent.click(screen.getByRole('button', { name: /use this workflow/i }));
      await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
      const saved = mockSavePhaseTemplate.mock.calls[0]![0] as Workflow;
      expect(saved.steps[0]!.role).toBe('investigator');
    });

    it('normalizes an out-of-vocab planner role to custom on save', async () => {
      mockPlan.mockResolvedValue({
        output: {
          workflowName: 'Unknown Role',
          reasoning: '',
          steps: [{ name: 'misc', role: 'other', promptPrefix: '', expectedOutput: '' }],
        },
      });
      render(
        <WorkflowPlanner
          workspaceId={'ws-7' as never}
          providerId="anthropic"
          initialProcess="unknown role"
          onWorkflowReady={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
      await waitFor(() => screen.getByText('Unknown Role'));
      fireEvent.click(screen.getByRole('button', { name: /use this workflow/i }));
      await waitFor(() => expect(mockSavePhaseTemplate).toHaveBeenCalledOnce());
      const saved = mockSavePhaseTemplate.mock.calls[0]![0] as Workflow;
      expect(saved.steps[0]!.role).toBe('custom');
    });

    it('shows a plan error and does not call savePhaseTemplate when planning fails', async () => {
      mockPlan.mockRejectedValue(new Error('model unavailable'));
      render(
        <WorkflowPlanner
          workspaceId={'ws-6' as never}
          providerId="anthropic"
          initialProcess="fail case"
          onWorkflowReady={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
      await waitFor(() => screen.getByRole('alert'));
      expect(screen.getByRole('alert').textContent).toMatch(/model unavailable/i);
      expect(mockSavePhaseTemplate).not.toHaveBeenCalled();
    });
  });
});
