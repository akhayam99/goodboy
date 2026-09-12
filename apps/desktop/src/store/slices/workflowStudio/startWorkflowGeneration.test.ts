import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCheapModel } from '@goodboy/core';
import type { Workflow, WorkflowId } from '@goodboy/types';

type SavedTemplate = { readonly steps: ReadonlyArray<Record<string, unknown>> };

const { formatWorkflowFromNLMock, generationTransport } = vi.hoisted(() => ({
  formatWorkflowFromNLMock: vi.fn(),
  generationTransport: {
    stdout: null as string | null,
    requests: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...actual,
    formatWorkflowFromNL: (params: Parameters<typeof actual.formatWorkflowFromNL>[0]) => {
      const stdout = generationTransport.stdout;
      if (stdout === null) {
        return formatWorkflowFromNLMock(params);
      }
      return actual.formatWorkflowFromNL({
        ...params,
        deps: {
          ...params.deps,
          invokeFn: async (_command: string, args?: Record<string, unknown>) => {
            generationTransport.requests.push((args?.['args'] ?? {}) as Record<string, unknown>);
            return { stdout, stderr: '', exitCode: 0 } as never;
          },
        },
      });
    },
  };
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
    const savePhaseTemplate = vi.fn(async (_args: unknown) => saved);
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

const generationReply = (steps: ReadonlyArray<Record<string, unknown>>): string =>
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: [
      '<<workflow>>',
      JSON.stringify({
        name: 'Review and ship',
        description: 'Review the change, then ship it.',
        goal: 'Ship the change',
        steps,
        suggestions: [],
      }),
      '<</workflow>>',
    ].join('\n'),
    usage: { input_tokens: 900, output_tokens: 180 },
  });

const generationState = () => {
  const saved = { id: 'wf-menu' as WorkflowId } satisfies Partial<Workflow>;
  const savePhaseTemplate = vi.fn(async (_args: unknown) => saved);
  const state = {
    workflowGenerations: {},
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ],
    providerCooldowns: {},
    budgetAlerts: [],
    workspaceOverrides: { 'ws-1': { defaultProviderId: 'anthropic' } },
    savePhaseTemplate,
    clearWorkflowStudioDraft: vi.fn(),
  };
  const set = vi.fn((updater: (current: typeof state) => Partial<typeof state>) => {
    Object.assign(state, updater(state));
  });
  return { state, set, savePhaseTemplate };
};

describe('startWorkflowGeneration model metadata', () => {
  afterEach(() => {
    generationTransport.stdout = null;
    generationTransport.requests.length = 0;
    vi.unstubAllEnvs();
  });

  it('metadata reaches the provider request', async () => {
    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'true');
    generationTransport.stdout = generationReply([
      {
        role: 'reviewer',
        name: 'Review',
        promptPrefix: 'Review the change',
        expectedOutput: 'Review findings',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'high',
        taskType: 'review',
        difficulty: 'heavy',
        modelReason: 'A precedence review needs the deepest model available.',
      },
    ]);
    const { state, set, savePhaseTemplate } = generationState();

    const accepted = await startWorkflowGeneration(
      set as never,
      (() => state) as never,
    )({
      workspaceId: 'ws-1' as never,
      description: 'Review and ship this change',
      workflow: null,
      form: null,
    });

    expect(accepted).toBe(true);
    expect(generationTransport.requests).toHaveLength(1);
    const prompt = generationTransport.requests[0]!['userMessage'] as string;

    expect(prompt).toContain(
      'Codes: exp=exploration, pln=planning, imp=implementation, dbg=debugging, rev=review, tst=testing, wrt=writing, gen=general; lt=light, st=standard, hv=heavy, uk=unknown.',
    );
    expect(prompt).toContain(
      'anthropic/opus-5 efforts low,medium,high,xhigh,max unassessed ctx 1000k $5/$25',
    );
    expect(prompt).toContain(
      'codex/gpt-5.6-sol efforts low,medium,high,xhigh,max unassessed ctx 1000k $5/$30',
    );

    const menuLines = prompt
      .split('\n')
      .filter((line) => line.startsWith('anthropic/') || line.startsWith('codex/'));
    expect(menuLines).toHaveLength(15);
    for (const line of menuLines) {
      expect(line).toContain('unassessed');
      expect(line).toMatch(/ ctx \d+k \$[\d.]+\/\$[\d.]+$/);
    }

    const savedSteps = (savePhaseTemplate.mock.calls[0]![0] as unknown as SavedTemplate).steps;
    expect(savedSteps[0]).toEqual(
      expect.objectContaining({
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6-sol',
        effort: 'high',
        taskProfile: { taskType: 'review', difficulty: 'heavy', basis: 'agent' },
      }),
    );
  });

  it('leaves catalog metadata out of the provider request while the flag is off', async () => {
    generationTransport.stdout = generationReply([
      {
        role: 'reviewer',
        name: 'Review',
        promptPrefix: 'Review the change',
        expectedOutput: 'Review findings',
      },
    ]);
    const { state, set, savePhaseTemplate } = generationState();

    await startWorkflowGeneration(
      set as never,
      (() => state) as never,
    )({
      workspaceId: 'ws-1' as never,
      description: 'Review and ship this change',
      workflow: null,
      form: null,
    });

    const prompt = generationTransport.requests[0]!['userMessage'] as string;
    expect(prompt).not.toContain('AVAILABLE MODELS');
    expect(prompt).not.toContain('unassessed');
    expect(prompt).not.toMatch(/\$[\d.]+\/\$[\d.]+/);

    const savedSteps = (savePhaseTemplate.mock.calls[0]![0] as unknown as SavedTemplate).steps;
    expect(savedSteps[0]).not.toHaveProperty('providerOverride');
    expect(savedSteps[0]).not.toHaveProperty('routingDecision');
  });
});
