import { describe, expect, it, vi } from 'vitest';
import type { Workflow, WorkflowId } from '@goodboy/types';

const { formatWorkflowFromNLMock } = vi.hoisted(() => ({
  formatWorkflowFromNLMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@goodboy/core', () => ({
  formatWorkflowFromNL: formatWorkflowFromNLMock,
}));

import { startWorkflowGeneration } from './startWorkflowGeneration';

describe('startWorkflowGeneration', () => {
  it('saves an agent-drafted preset as custom', async () => {
    formatWorkflowFromNLMock.mockResolvedValue({
      name: 'Review and ship',
      description: 'Review the change, then ship it.',
      goal: 'Ship the change',
      steps: [
        {
          role: 'reviewer',
          name: 'Review',
          promptPrefix: 'Review the change',
          expectedOutput: 'Review findings',
        },
      ],
    });
    const saved = { id: 'wf-1' as WorkflowId } satisfies Partial<Workflow>;
    const savePhaseTemplate = vi.fn(async () => saved);
    const clearWorkflowStudioDraft = vi.fn();
    const state = {
      workflowGenerations: {},
      savePhaseTemplate,
      clearWorkflowStudioDraft,
    };
    const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
      Object.assign(state, updater(state));
    });
    const generate = startWorkflowGeneration(set as never, (() => state) as never);

    const accepted = await generate({
      workspaceId: 'ws-1' as never,
      providerId: 'anthropic',
      description: 'Review and ship this change',
      workflow: null,
      form: null,
    });

    expect(accepted).toBe(true);
    expect(savePhaseTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ isPreset: true, origin: 'custom' }),
    );
  });
});
