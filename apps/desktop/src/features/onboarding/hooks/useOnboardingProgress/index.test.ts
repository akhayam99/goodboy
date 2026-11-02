import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingStepId } from '../../onboardingSettings';

type Workspace = { id: string; name?: string; profile?: { roles: ReadonlyArray<string> } };

let completed: Array<OnboardingStepId> = [];
const workspaces: Array<Workspace> = [];
let currentWorkspaceId: string | null = null;
let sessionPhaseRuns: Record<string, Array<{ status: string }>> = {};
let agentTurnState: Record<string, { kind: string }> = {};
let providers: Array<{ id: string; connection: string }> = [];
let projects: Array<{ workspaceId: string }> = [];
let wizardState = 'done';

const { markStepCompleteMock } = vi.hoisted(() => ({
  markStepCompleteMock: vi.fn(),
}));

vi.mock('../../onboardingSettings', () => ({
  ONBOARDING_PROGRESS_EVENT: 'goodboy:onboarding-progress',
  getCompleted: () => completed,
  getWizardState: () => wizardState,
  isCollapsed: () => false,
  isFinished: () => false,
  markStepComplete: markStepCompleteMock,
}));

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (s: object) => unknown) =>
    selector({
      sessionPhaseRuns,
      agentTurnState,
      providers,
      projects,
      currentWorkspaceId,
    }),
  useWorkspaces: () => workspaces,
}));

const reset = () => {
  completed = [];
  wizardState = 'done';
  workspaces.length = 0;
  currentWorkspaceId = null;
  sessionPhaseRuns = {};
  agentTurnState = {};
  providers = [];
  projects = [];
  markStepCompleteMock.mockReset();
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
      workspace: 'Harborline, 3 projects',
      'first-session': 'Ask Scout about the code',
    });
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

  it('skips steps that are already completed', () => {
    completed = ['agents'];
    providers = [{ id: 'anthropic', connection: 'connected' }];
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).not.toHaveBeenCalledWith('agents');
  });

  it('counts the three setup steps through setupProgress, About you left out', () => {
    completed = ['agents', 'workspace', 'profile'];
    const { result } = renderHook(() => useOnboardingProgress());
    expect(result.current.setup.count).toBe('2 of 3');
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
