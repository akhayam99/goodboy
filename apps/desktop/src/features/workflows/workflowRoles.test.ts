// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';

const { invokeCommandSpy } = vi.hoisted(() => ({ invokeCommandSpy: vi.fn() }));

vi.mock('../../shared/lib/invokeCommand', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/lib/invokeCommand')>()),
  invokeCommand: invokeCommandSpy,
}));

vi.mock('../../shared/lib/db', () => ({ tauriDatabase: { execute: vi.fn(), select: vi.fn() } }));

import { invokeStepDefList, invokeWorkflowList, invokeWorkflowsForSession } from './workflows';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;

const stepRow = (role: string | null) => ({
  id: 'step-fix',
  workflowId: 'wf-harborline',
  libraryStepId: 'seed_resolver',
  role,
  ordinal: 0,
  name: 'Fix the review findings',
  promptPrefix: 'Fix them.',
  expectedOutput: null,
  providerOverride: null,
  modelOverride: null,
  effort: null,
  verbosity: null,
  orchestratorReason: null,
  routingLock: null,
  routingDecision: null,
  taskProfile: null,
  size: null,
});

const workflowRow = (role: string | null) => ({
  id: 'wf-harborline',
  workspaceId: WORKSPACE_ID,
  name: 'Ship the questionnaire',
  description: 'Plan, build, fix',
  goal: null,
  processText: null,
  steps: [stepRow(role)],
  createdAt: '2026-10-07T10:00:00.000Z',
  updatedAt: '2026-10-07T10:00:00.000Z',
  deletedAt: null,
  isPreset: true,
  origin: null,
});

describe('workflow step roles on load', () => {
  beforeEach(() => {
    invokeCommandSpy.mockReset();
  });

  it('reads a saved Resolve step as an Implement step, in a workspace list', async () => {
    invokeCommandSpy.mockResolvedValue([workflowRow('resolver')]);

    const [workflow] = await invokeWorkflowList(WORKSPACE_ID);

    expect(workflow?.steps.map((step) => step.role)).toEqual(['implementer']);
  });

  it('reads a saved Resolve step as an Implement step, in a session run', async () => {
    invokeCommandSpy.mockResolvedValue([workflowRow('resolver')]);

    const [workflow] = await invokeWorkflowsForSession('session-1' as SessionId);

    expect(workflow?.steps.map((step) => step.role)).toEqual(['implementer']);
  });

  it('leaves the other roles alone', async () => {
    invokeCommandSpy.mockResolvedValue([workflowRow('reviewer')]);

    const [workflow] = await invokeWorkflowList(WORKSPACE_ID);

    expect(workflow?.steps.map((step) => step.role)).toEqual(['reviewer']);
  });

  it('reads a saved step of the Resolve role as an Implement step', async () => {
    invokeCommandSpy.mockResolvedValue([
      {
        id: 'lib-1',
        workspaceId: WORKSPACE_ID,
        role: 'resolver',
        name: 'Resolve comments',
        promptPrefix: 'Work through them.',
        providerDefault: null,
        modelDefault: null,
        effortDefault: null,
        verbosityDefault: null,
        expectedOutput: null,
        baseStepId: null,
        createdAt: '2026-10-07T10:00:00.000Z',
        updatedAt: '2026-10-07T10:00:00.000Z',
      },
    ]);

    const [saved] = await invokeStepDefList(WORKSPACE_ID);

    expect(saved?.role).toBe('implementer');
  });
});
