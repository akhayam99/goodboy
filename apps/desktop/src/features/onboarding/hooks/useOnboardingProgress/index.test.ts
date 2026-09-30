import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingStepId } from '../../onboarding-store';

type Workspace = { id: string; profile?: { roles: ReadonlyArray<string> } };

let completed: Array<OnboardingStepId> = [];
const workspaces: Array<Workspace> = [];
let currentWorkspaceId: string | null = null;
let workspaceIntegrations: Record<string, Array<{ provider: string }>> = {};
let sessionPhaseRuns: Record<string, Array<{ status: string }>> = {};
let agentTurnState: Record<string, { kind: string }> = {};
let providers: Array<{ connection: string }> = [];
let projects: Array<{ workspaceId: string }> = [];
let githubStatus: { mode: string } | null = null;

const { markStepCompleteMock, ghStatusMock } = vi.hoisted(() => ({
  markStepCompleteMock: vi.fn(),
  ghStatusMock: vi.fn(async () => ({ scoped: false }) as unknown),
}));

const { STEPS } = vi.hoisted(() => ({
  STEPS: [
    { id: 'provider', title: 'x', why: 'x' },
    { id: 'project', title: 'x', why: 'x' },
    { id: 'codeHost', title: 'x', why: 'x' },
    { id: 'taskManager', title: 'x', why: 'x' },
    { id: 'firstSession', title: 'x', why: 'x' },
    { id: 'profile', title: 'x', why: 'x' },
  ],
}));

vi.mock('../../onboarding-store', () => ({
  ONBOARDING_STEPS: STEPS,
  getCompleted: () => completed,
  isCollapsed: () => false,
  isFinished: () => false,
  isWizardDone: () => true,
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

function reset() {
  completed = [];
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
}

import { useOnboardingProgress } from './index';

describe('useOnboardingProgress', () => {
  beforeEach(reset);
  afterEach(reset);

  it('marks the provider and the project once they exist', () => {
    workspaces.push({ id: 'w1' });
    providers = [{ connection: 'connected' }];
    projects = [{ workspaceId: 'w1' }];
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('provider');
    expect(markStepCompleteMock).toHaveBeenCalledWith('project');
  });

  it('marks codeHost when GitLab or Bitbucket is connected for the workspace', () => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'bitbucket' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('codeHost');
  });

  it('marks codeHost once gh status reports a scoped token', async () => {
    workspaces.push({ id: 'w1' });
    ghStatusMock.mockResolvedValue({ scoped: true });
    renderHook(() => useOnboardingProgress());
    await waitFor(() => expect(markStepCompleteMock).toHaveBeenCalledWith('codeHost'));
  });

  it('marks codeHost when gh is signed in on this Mac', () => {
    workspaces.push({ id: 'w1' });
    githubStatus = { mode: 'cli' };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('codeHost');
  });

  it.each(['linear', 'jira'])('marks taskManager when %s is connected', (provider) => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('taskManager');
  });

  it('does not count Sentry or Slack as a task manager', () => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'sentry' }, { provider: 'slack' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).not.toHaveBeenCalledWith('taskManager');
  });

  it('leaves the first session open while an agent only exists', () => {
    sessionPhaseRuns = { s1: [{ status: 'running' }] };
    agentTurnState = { a1: { kind: 'running' } };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).not.toHaveBeenCalledWith('firstSession');
  });

  it('ticks the first session once an agent finishes a turn', () => {
    sessionPhaseRuns = { s1: [{ status: 'running' }] };
    agentTurnState = { a1: { kind: 'idle' } };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('firstSession');
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
    completed = ['codeHost'];
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'gitlab' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).not.toHaveBeenCalledWith('codeHost');
    expect(ghStatusMock).not.toHaveBeenCalled();
  });

  it('reports completed count and total', () => {
    completed = ['provider', 'project'];
    const { result } = renderHook(() => useOnboardingProgress());
    expect(result.current.completedCount).toBe(2);
    expect(result.current.totalCount).toBe(6);
    expect(result.current.isDone).toBe(false);
    expect(result.current.wizardDone).toBe(true);
  });
});
