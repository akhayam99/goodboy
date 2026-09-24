import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionId, WorkflowRun, WorkflowRunId, WorkspaceId } from '@goodboy/types';

const { invokeMock, updateGeneratedTitleSpy } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  updateGeneratedTitleSpy: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@goodboy/db', () => ({ updateGeneratedWorkflowRunTitle: updateGeneratedTitleSpy }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { generateWorkflowRunTitle } from './generateWorkflowRunTitle';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const RUN_ID = 'run-1' as WorkflowRunId;
const GOAL = 'The login page loops back to itself after the OAuth redirect on Safari.';

const baseRun: WorkflowRun = {
  id: RUN_ID,
  workflowId: 'wf-1' as WorkflowRun['workflowId'],
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  goal: GOAL,
};

const sessionWith = (run: WorkflowRun) =>
  ({
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'ship the thing',
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    workflowRuns: [run],
  }) as unknown as Session;

type State = {
  sessions: ReadonlyArray<Session>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  workspaceOverrides: Record<string, unknown>;
};

const buildHarness = (run: WorkflowRun = baseRun) => {
  const state: State = {
    sessions: [sessionWith(run)],
    sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
    workspaceOverrides: {},
  };
  const set = vi.fn((updater: (s: State) => Partial<State>) => {
    Object.assign(state, updater(state));
  });
  const generate = () =>
    generateWorkflowRunTitle({
      set: set as unknown as Parameters<typeof generateWorkflowRunTitle>[0]['set'],
      get: (() => state) as unknown as Parameters<typeof generateWorkflowRunTitle>[0]['get'],
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
    });
  const currentRun = () => state.sessions[0]?.workflowRuns[0];
  return { generate, state, currentRun };
};

const okStdout = (result: string) => JSON.stringify({ result });

describe('generateWorkflowRunTitle', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('titles the run from its goal with the naming task model', async () => {
    invokeMock.mockResolvedValue({
      stdout: okStdout('Fix Safari OAuth login loop'),
      stderr: '',
      exitCode: 0,
    });
    updateGeneratedTitleSpy.mockResolvedValue(true);
    const { generate, currentRun } = buildHarness();

    await generate();

    expect(updateGeneratedTitleSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workflowRunId: RUN_ID, title: 'Fix Safari OAuth login loop' }),
    );
    expect(currentRun()?.title).toBe('Fix Safari OAuth login loop');
  });

  it('skips a run that has no goal to name it from', async () => {
    const { generate, currentRun } = buildHarness({ ...baseRun, goal: '   ' });

    await generate();

    expect(invokeMock).not.toHaveBeenCalled();
    expect(currentRun()?.title).toBeUndefined();
  });

  it('never replaces the name the user chose', async () => {
    const { generate, currentRun } = buildHarness({
      ...baseRun,
      title: 'Login loop',
      titleUserEdited: true,
    });

    await generate();

    expect(invokeMock).not.toHaveBeenCalled();
    expect(currentRun()?.title).toBe('Login loop');
  });

  it('keeps a rename that lands while the title is being generated', async () => {
    invokeMock.mockResolvedValue({
      stdout: okStdout('Fix Safari OAuth login loop'),
      stderr: '',
      exitCode: 0,
    });
    updateGeneratedTitleSpy.mockResolvedValue(false);
    const { generate, currentRun } = buildHarness();

    await generate();

    expect(currentRun()?.title).toBeUndefined();
  });

  it('falls back to the workflow name silently when generation fails', async () => {
    invokeMock.mockRejectedValue(new Error('provider unavailable'));
    const { generate, currentRun } = buildHarness();

    await expect(generate()).resolves.toBeUndefined();

    expect(updateGeneratedTitleSpy).not.toHaveBeenCalled();
    expect(currentRun()?.title).toBeUndefined();
  });
});
