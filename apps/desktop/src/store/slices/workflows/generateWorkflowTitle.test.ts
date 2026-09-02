import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';

const { invokeMock, invokeWorkflowUpsertSpy } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  invokeWorkflowUpsertSpy: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
}));

import { generateWorkflowTitle } from './generateWorkflowTitle';
import {
  markWorkflowTitleUserEdited,
  unmarkWorkflowTitleUserEdited,
} from './workflowTitleUserEdited';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'wf-1' as WorkflowId;
const NOW = '2026-07-23T00:00:00.000Z' as IsoDateTime;
const FALLBACK_NAME = 'Untitled orchestrated workflow';

const session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'ship the thing',
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
} as unknown as Session;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: FALLBACK_NAME,
  description: 'Steps are decided at runtime from the latest results.',
  goal: 'ship the thing',
  processText: 'read the code, then ship it',
  steps: [],
  isPreset: false,
  origin: 'orchestrated',
  createdAt: NOW,
  updatedAt: NOW,
};

type State = {
  sessions: ReadonlyArray<Session>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  workspaceOverrides: Record<string, unknown>;
  phaseTemplates: Record<WorkspaceId, ReadonlyArray<Workflow>>;
  emitNotification: ReturnType<typeof vi.fn>;
};

const buildHarness = (stateOverrides: Partial<State> = {}) => {
  const state: State = {
    sessions: [session],
    sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
    workspaceOverrides: {},
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    emitNotification: vi.fn(async () => undefined),
    ...stateOverrides,
  };
  const set = vi.fn((updater: (s: State) => Partial<State>) => {
    Object.assign(state, updater(state));
  });
  const get = (() => state) as unknown as Parameters<ReturnType<typeof generateWorkflowTitle>>[0];
  const generate = generateWorkflowTitle(
    set as unknown as Parameters<typeof generateWorkflowTitle>[0],
    get as unknown as Parameters<typeof generateWorkflowTitle>[1],
  );
  return { generate, state, set };
};

const okStdout = (result: string) => JSON.stringify({ result });

describe('generateWorkflowTitle', () => {
  afterEach(() => {
    unmarkWorkflowTitleUserEdited(WORKFLOW_ID);
    vi.clearAllMocks();
  });

  it('replaces the placeholder name with the generated title', async () => {
    invokeMock.mockResolvedValue({
      stdout: okStdout('Ship the auth rework'),
      stderr: '',
      exitCode: 0,
    });
    invokeWorkflowUpsertSpy.mockResolvedValue({ ...workflow, name: 'Ship the auth rework' });
    const { generate, state } = buildHarness();

    await generate(
      WORKSPACE_ID,
      WORKFLOW_ID,
      SESSION_ID,
      FALLBACK_NAME,
      'ship the thing',
      'read the code, then ship it',
    );

    expect(invokeWorkflowUpsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: WORKFLOW_ID, name: 'Ship the auth rework' }),
    );
    expect(state.phaseTemplates[WORKSPACE_ID]?.[0]?.name).toBe('Ship the auth rework');
  });

  it('leaves a visibly provisional name and stays silent on generation failure', async () => {
    invokeMock.mockRejectedValue(new Error('provider unavailable'));
    const { generate, state } = buildHarness();

    await expect(
      generate(WORKSPACE_ID, WORKFLOW_ID, SESSION_ID, FALLBACK_NAME, 'ship the thing', 'do it'),
    ).resolves.toBeUndefined();

    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
    expect(state.phaseTemplates[WORKSPACE_ID]?.[0]?.name).toBe(FALLBACK_NAME);
    expect(state.emitNotification).not.toHaveBeenCalled();
  });

  it('never overwrites a title the user already renamed', async () => {
    invokeMock.mockResolvedValue({
      stdout: okStdout('Ship the auth rework'),
      stderr: '',
      exitCode: 0,
    });
    markWorkflowTitleUserEdited(WORKFLOW_ID);
    const { generate, state } = buildHarness();

    await generate(
      WORKSPACE_ID,
      WORKFLOW_ID,
      SESSION_ID,
      FALLBACK_NAME,
      'ship the thing',
      'read the code, then ship it',
    );

    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
    expect(state.phaseTemplates[WORKSPACE_ID]?.[0]?.name).toBe(FALLBACK_NAME);
  });

  it('restores a user rename that lands while the generated title is saving', async () => {
    invokeMock.mockResolvedValue({
      stdout: okStdout('Ship the auth rework'),
      stderr: '',
      exitCode: 0,
    });
    const finishGeneratedSave = vi.fn<(workflow: Workflow) => void>();
    const generatedSave = new Promise<Workflow>((resolve) => {
      finishGeneratedSave.mockImplementation(resolve);
    });
    invokeWorkflowUpsertSpy
      .mockImplementationOnce(() => generatedSave)
      .mockResolvedValueOnce({ ...workflow, name: 'My chosen workflow' });
    const { generate, state } = buildHarness();

    const generation = generate(
      WORKSPACE_ID,
      WORKFLOW_ID,
      SESSION_ID,
      FALLBACK_NAME,
      'ship the thing',
      'read the code, then ship it',
    );
    await vi.waitFor(() => expect(invokeWorkflowUpsertSpy).toHaveBeenCalledOnce());
    markWorkflowTitleUserEdited(WORKFLOW_ID);
    state.phaseTemplates[WORKSPACE_ID] = [{ ...workflow, name: 'My chosen workflow' }];
    finishGeneratedSave({ ...workflow, name: 'Ship the auth rework' });
    await generation;

    expect(invokeWorkflowUpsertSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: WORKFLOW_ID, name: 'My chosen workflow' }),
    );
    expect(state.phaseTemplates[WORKSPACE_ID]?.[0]?.name).toBe('My chosen workflow');
  });

  it('skips the write when the name no longer matches the fallback it was assigned', async () => {
    invokeMock.mockResolvedValue({
      stdout: okStdout('Ship the auth rework'),
      stderr: '',
      exitCode: 0,
    });
    const { generate, state } = buildHarness({
      phaseTemplates: {
        [WORKSPACE_ID]: [{ ...workflow, name: 'Untitled orchestrated workflow 2' }],
      },
    });

    await generate(
      WORKSPACE_ID,
      WORKFLOW_ID,
      SESSION_ID,
      FALLBACK_NAME,
      'ship the thing',
      'read the code, then ship it',
    );

    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
    expect(state.phaseTemplates[WORKSPACE_ID]?.[0]?.name).toBe('Untitled orchestrated workflow 2');
  });
});
