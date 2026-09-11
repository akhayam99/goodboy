import { describe, expect, it, vi } from 'vitest';
import { getCheapModel } from '@goodboy/core';
import type { Workflow, WorkflowId } from '@goodboy/types';

type SavedTemplate = { readonly steps: ReadonlyArray<Record<string, unknown>> };

const { formatWorkflowFromNLMock } = vi.hoisted(() => ({
  formatWorkflowFromNLMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return { ...actual, formatWorkflowFromNL: formatWorkflowFromNLMock };
});

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
      providers: [
        { id: 'anthropic', connection: 'connected' },
        { id: 'codex', connection: 'connected' },
      ],
      workspaceOverrides: {
        'ws-1': {
          defaultProviderId: 'anthropic',
          taskModels: {
            plan_generation: {
              providerId: 'codex',
              model: 'gpt-5.6-terra',
              effort: 'high',
            },
          },
        },
      },
      savePhaseTemplate,
      clearWorkflowStudioDraft,
    };
    const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
      Object.assign(state, updater(state));
    });
    const generate = startWorkflowGeneration(set as never, (() => state) as never);

    const accepted = await generate({
      workspaceId: 'ws-1' as never,
      description: 'Review and ship this change',
      workflow: null,
      form: null,
    });

    expect(accepted).toBe(true);
    expect(savePhaseTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ isPreset: true, origin: 'custom' }),
    );
    expect(formatWorkflowFromNLMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deps: expect.objectContaining({
          providerId: 'codex',
          model: 'gpt-5.6-terra',
          effort: 'high',
        }),
      }),
    );
  });

  it('uses the first connected provider automatic model when no workspace default is set', async () => {
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
    const saved = { id: 'wf-2' as WorkflowId } satisfies Partial<Workflow>;
    const state = {
      workflowGenerations: {},
      providers: [{ id: 'codex', connection: 'connected' }],
      workspaceOverrides: {},
      savePhaseTemplate: vi.fn(async () => saved),
      clearWorkflowStudioDraft: vi.fn(),
    };
    const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
      Object.assign(state, updater(state));
    });
    const generate = startWorkflowGeneration(set as never, (() => state) as never);

    await generate({
      workspaceId: 'ws-1' as never,
      description: 'Review and ship this change',
      workflow: null,
      form: null,
    });

    expect(formatWorkflowFromNLMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deps: expect.objectContaining({
          providerId: 'codex',
          model: getCheapModel('codex'),
        }),
      }),
    );
  });

  it('uses the workspace default automatic model when it is set and connected', async () => {
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
    const saved = { id: 'wf-3' as WorkflowId } satisfies Partial<Workflow>;
    const state = {
      workflowGenerations: {},
      providers: [
        { id: 'codex', connection: 'connected' },
        { id: 'anthropic', connection: 'connected' },
      ],
      workspaceOverrides: {
        'ws-1': { defaultProviderId: 'anthropic' },
      },
      savePhaseTemplate: vi.fn(async () => saved),
      clearWorkflowStudioDraft: vi.fn(),
    };
    const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
      Object.assign(state, updater(state));
    });
    const generate = startWorkflowGeneration(set as never, (() => state) as never);

    await generate({
      workspaceId: 'ws-1' as never,
      description: 'Review and ship this change',
      workflow: null,
      form: null,
    });

    expect(formatWorkflowFromNLMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deps: expect.objectContaining({
          providerId: 'anthropic',
          model: getCheapModel('anthropic'),
        }),
      }),
    );
  });

  it('falls back to a connected provider when the workspace default is set but disconnected', async () => {
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
    const saved = { id: 'wf-4' as WorkflowId } satisfies Partial<Workflow>;
    const state = {
      workflowGenerations: {},
      providers: [{ id: 'codex', connection: 'connected' }],
      workspaceOverrides: {
        'ws-1': { defaultProviderId: 'anthropic' },
      },
      savePhaseTemplate: vi.fn(async () => saved),
      clearWorkflowStudioDraft: vi.fn(),
    };
    const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
      Object.assign(state, updater(state));
    });
    const generate = startWorkflowGeneration(set as never, (() => state) as never);

    await generate({
      workspaceId: 'ws-1' as never,
      description: 'Review and ship this change',
      workflow: null,
      form: null,
    });

    expect(formatWorkflowFromNLMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deps: expect.objectContaining({
          providerId: 'codex',
          model: getCheapModel('codex'),
        }),
      }),
    );
  });
  it('leaves a generated step unrouted while the metadata flag is off', async () => {
    formatWorkflowFromNLMock.mockResolvedValue({
      name: 'Review and ship',
      description: 'Review the change, then ship it.',
      steps: [
        {
          role: 'reviewer',
          name: 'Review',
          promptPrefix: 'Review the change',
          expectedOutput: 'Review findings',
          routing: { provider: 'anthropic', model: 'opus-5', effort: 'high' },
        },
      ],
    });
    const savePhaseTemplate = vi.fn(async (template: SavedTemplate) => {
      expect(template.steps.length).toBeGreaterThan(0);
      return { id: 'wf-5' as WorkflowId };
    });
    const state = {
      workflowGenerations: {},
      providers: [{ id: 'anthropic', connection: 'connected' }],
      providerCooldowns: {},
      budgetAlerts: [],
      workspaceOverrides: {},
      savePhaseTemplate,
      clearWorkflowStudioDraft: vi.fn(),
    };
    const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
      Object.assign(state, updater(state));
    });
    const generate = startWorkflowGeneration(set as never, (() => state) as never);

    await generate({
      workspaceId: 'ws-1' as never,
      description: 'Review and ship this change',
      workflow: null,
      form: null,
    });

    const args = savePhaseTemplate.mock.calls[0]![0];
    expect(args.steps[0]).toEqual({
      role: 'reviewer',
      ordinal: 0,
      name: 'Review',
      promptPrefix: 'Review the change',
      expectedOutput: 'Review findings',
    });
    expect(formatWorkflowFromNLMock.mock.calls.at(-1)?.[0].input).not.toHaveProperty('modelMenu');
  });

  it('carries the emitted pick and profile onto a generated step when the flag is on', async () => {
    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'true');
    formatWorkflowFromNLMock.mockResolvedValue({
      name: 'Review and ship',
      description: 'Review the change, then ship it.',
      steps: [
        {
          role: 'reviewer',
          name: 'Review',
          promptPrefix: 'Review the change',
          expectedOutput: 'Review findings',
          routing: {
            provider: 'anthropic',
            model: 'opus-5',
            effort: 'high',
            taskType: 'review',
            difficulty: 'standard',
            modelReason: 'The review spans the whole migration runner.',
          },
        },
        {
          role: 'implementer',
          name: 'Build',
          promptPrefix: 'Build it',
          expectedOutput: 'Code',
        },
      ],
    });
    const savePhaseTemplate = vi.fn(async (template: SavedTemplate) => {
      expect(template.steps.length).toBeGreaterThan(0);
      return { id: 'wf-6' as WorkflowId };
    });
    const state = {
      workflowGenerations: {},
      providers: [{ id: 'anthropic', connection: 'connected' }],
      providerCooldowns: {},
      budgetAlerts: [],
      workspaceOverrides: {},
      savePhaseTemplate,
      clearWorkflowStudioDraft: vi.fn(),
    };
    const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
      Object.assign(state, updater(state));
    });
    const generate = startWorkflowGeneration(set as never, (() => state) as never);

    await generate({
      workspaceId: 'ws-1' as never,
      description: 'Review and ship this change',
      workflow: null,
      form: null,
    });

    const args = savePhaseTemplate.mock.calls[0]![0];
    expect(args.steps[0]).toMatchObject({
      providerOverride: 'anthropic',
      modelOverride: 'opus-5',
      effort: 'high',
      taskProfile: { taskType: 'review', difficulty: 'standard', basis: 'agent' },
    });
    expect(args.steps[0]?.['routingDecision']).toMatchObject({
      version: 1,
      source: 'agent',
      selected: { provider: 'anthropic', model: 'opus-5', effort: 'high' },
    });
    expect(args.steps[1]?.['routingDecision']).toMatchObject({ source: 'heuristic' });
    expect(args.steps[1]?.['modelOverride']).toBeDefined();
    expect(formatWorkflowFromNLMock.mock.calls.at(-1)?.[0].input.modelMenu.length).toBeGreaterThan(
      0,
    );
    vi.unstubAllEnvs();
  });
});
