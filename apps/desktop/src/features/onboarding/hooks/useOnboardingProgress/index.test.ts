import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingStepId } from '../../onboarding-store';

type Workspace = { id: string; name?: string; profile?: { roles: ReadonlyArray<string> } };

let completed: Array<OnboardingStepId> = [];
const workspaces: Array<Workspace> = [];
let currentWorkspaceId: string | null = null;
let workspaceIntegrations: Record<string, Array<{ provider: string }>> = {};
let sessionPhaseRuns: Record<string, Array<{ status: string }>> = {};
let agentTurnState: Record<string, { kind: string }> = {};
let providers: Array<{ id: string; connection: string }> = [];
let projects: Array<{ workspaceId: string }> = [];
let wizardState = 'done';
let githubStatus: { mode: string } | null = null;

const { markStepCompleteMock, ghStatusMock } = vi.hoisted(() => ({
  markStepCompleteMock: vi.fn(),
  ghStatusMock: vi.fn(async () => ({ scoped: false }) as unknown),
}));

vi.mock('../../onboarding-store', () => ({
  ONBOARDING_PROGRESS_EVENT: 'goodboy:onboarding-progress',
  getCompleted: () => completed,
  getWizardState: () => wizardState,
  isCollapsed: () => false,
  isFinished: () => false,
  markStepComplete: markStepCompleteMock,
}));

vi.mock('../../../integrations/github/github', () => ({
  ghStatus: ghStatusMock,
}));

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (s: object) => unknown) =>
    selector({
      sessionPhaseRuns,
      agentTurnState,
      providers,
      projects,
      githubStatus,
      currentWorkspaceId,
      workspaceIntegrations,
    }),
  useWorkspaces: () => workspaces,
}));

const reset = () => {
  completed = [];
  wizardState = 'done';
  workspaces.length = 0;
  currentWorkspaceId = null;
  workspaceIntegrations = {};
  sessionPhaseRuns = {};
  agentTurnState = {};
  providers = [];
  projects = [];
  githubStatus = null;
  markStepCompleteMock.mockReset();
  ghStatusMock.mockReset();
  ghStatusMock.mockResolvedValue({ scoped: false });
};

import { useOnboardingProgress } from './index';

describe('useOnboardingProgress', () => {
  beforeEach(reset);
  afterEach(reset);

  it('marks Agents and Workspace once an agent is ready and a folder is linked', () => {
    workspaces.push({ id: 'w1' });
    providers = [{ id: 'anthropic', connection: 'connected' }];
    projects = [{ workspaceId: 'w1' }];
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('agents');
    expect(markStepCompleteMock).toHaveBeenCalledWith('workspace');
  });

  it('describes each row with what is ready', () => {
    workspaces.push({ id: 'w1', name: 'Harborline' });
    providers = [{ id: 'anthropic', connection: 'connected' }];
    projects = [{ workspaceId: 'w1' }, { workspaceId: 'w1' }, { workspaceId: 'w1' }];
    const { result } = renderHook(() => useOnboardingProgress());
    expect(result.current.details).toEqual({
      agents: 'Claude is ready',
      workspace: 'Harborline, 3 folders',
      tools: 'Optional',
      'first-session': 'Ask Scout about the code',
    });
  });

  it('marks Tools when GitLab or Bitbucket is connected for the workspace', () => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'bitbucket' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('tools');
  });

  it('marks Tools once gh status reports a scoped token', async () => {
    workspaces.push({ id: 'w1' });
    ghStatusMock.mockResolvedValue({ scoped: true });
    renderHook(() => useOnboardingProgress());
    await waitFor(() => expect(markStepCompleteMock).toHaveBeenCalledWith('tools'));
  });

  it('marks Tools when gh is signed in on this Mac', () => {
    workspaces.push({ id: 'w1' });
    githubStatus = { mode: 'cli' };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('tools');
  });

  it.each(['linear', 'jira'])('marks Tools when %s is connected', (provider) => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('tools');
  });

  it('does not count Sentry or Slack as a task manager', () => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'sentry' }, { provider: 'slack' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).not.toHaveBeenCalledWith('tools');
  });

  it('leaves the first session open while an agent only exists', () => {
    sessionPhaseRuns = { s1: [{ status: 'running' }] };
    agentTurnState = { a1: { kind: 'running' } };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).not.toHaveBeenCalledWith('first-session');
  });

  it('ticks the first session once an agent finishes a turn', () => {
    sessionPhaseRuns = { s1: [{ status: 'running' }] };
    agentTurnState = { a1: { kind: 'idle' } };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('first-session');
  });

  it('ticks the profile only once it holds something', () => {
    workspaces.push({ id: 'w1', profile: { roles: [] } });
    const { result, rerender } = renderHook(() => useOnboardingProgress());
    expect(result.current.completed.has('profile')).toBe(false);
    workspaces[0] = { id: 'w1', profile: { roles: ['Designer'] } };
    rerender();
    expect(result.current.completed.has('profile')).toBe(true);
  });

  it('skips already-completed steps and never re-queries gh status', () => {
    completed = ['tools'];
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'gitlab' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).not.toHaveBeenCalledWith('tools');
    expect(ghStatusMock).not.toHaveBeenCalled();
  });

  it('counts the four setup steps through setupProgress, About you left out', () => {
    completed = ['agents', 'workspace', 'profile'];
    const { result } = renderHook(() => useOnboardingProgress());
    expect(result.current.setup.count).toBe('2 of 4');
    expect(result.current.setup.isDone).toBe(false);
    expect(result.current.isWizardDone).toBe(true);
  });

  it('suggests About you only after the first session', () => {
    completed = ['first-session'];
    const { result } = renderHook(() => useOnboardingProgress());
    expect(result.current.suggestsProfile).toBe(true);
  });

  it('reads a paused setup', () => {
    wizardState = 'later';
    const { result } = renderHook(() => useOnboardingProgress());
    expect(result.current.wizard).toBe('later');
    expect(result.current.isWizardDone).toBe(false);
  });
});
