import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingStepId } from '../../onboarding-store';

let completed: Array<OnboardingStepId> = [];
const workspaces: Array<{ id: string; kind?: 'repo' | 'simple' }> = [];
let currentWorkspaceId: string | null = null;
let workspaceIntegrations: Record<string, Array<{ provider: string }>> = {};
let sessions: Array<unknown> = [];
let sessionPhaseRuns: Record<string, unknown[]> = {};
let sessionPlans: Record<string, unknown[]> = {};

const { markStepCompleteMock, ghStatusMock } = vi.hoisted(() => ({
  markStepCompleteMock: vi.fn(),
  ghStatusMock: vi.fn(async () => ({ scoped: false }) as unknown),
}));

const { STEPS } = vi.hoisted(() => ({
  STEPS: [
    { id: 'workspace', title: 'x', why: 'x' },
    { id: 'codeHost', title: 'x', why: 'x' },
    { id: 'tools', title: 'x', why: 'x' },
    { id: 'session', title: 'x', why: 'x' },
    { id: 'agent', title: 'x', why: 'x' },
    { id: 'plan', title: 'x', why: 'x' },
    { id: 'palette', title: 'x', why: 'x' },
  ],
}));

vi.mock('../../onboarding-store', () => ({
  ONBOARDING_STEPS: STEPS,
  visibleOnboardingSteps: ({ isSimple }: { readonly isSimple: boolean }) =>
    isSimple ? STEPS.filter((step) => step.id !== 'codeHost') : STEPS,
  getCompleted: () => completed,
  isCollapsed: () => false,
  isFinished: () => false,
  markStepComplete: markStepCompleteMock,
}));

vi.mock('../../../github/github', () => ({
  ghStatus: ghStatusMock,
}));

vi.mock('../../../../store', () => ({
  useAppStore: (
    selector: (s: {
      sessions: typeof sessions;
      sessionPhaseRuns: Record<string, unknown[]>;
      sessionPlans: Record<string, unknown[]>;
      currentWorkspaceId: string | null;
      workspaceIntegrations: typeof workspaceIntegrations;
    }) => unknown,
  ) =>
    selector({
      sessions,
      sessionPhaseRuns,
      sessionPlans,
      currentWorkspaceId,
      workspaceIntegrations,
    }),
  useCurrentSession: () => null,
  useWorkspaces: () => workspaces,
}));

function reset() {
  completed = [];
  workspaces.length = 0;
  currentWorkspaceId = null;
  workspaceIntegrations = {};
  sessions = [];
  sessionPhaseRuns = {};
  sessionPlans = {};
  markStepCompleteMock.mockReset();
  ghStatusMock.mockReset();
  ghStatusMock.mockResolvedValue({ scoped: false });
}

import { useOnboardingProgress } from './index';

describe('useOnboardingProgress auto-mark', () => {
  beforeEach(reset);
  afterEach(reset);

  it('marks codeHost when GitLab is connected for the workspace', () => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'gitlab' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('codeHost');
  });

  it('marks codeHost once gh status reports a scoped token', async () => {
    workspaces.push({ id: 'w1' });
    ghStatusMock.mockResolvedValue({ scoped: true });
    renderHook(() => useOnboardingProgress());
    await waitFor(() => expect(markStepCompleteMock).toHaveBeenCalledWith('codeHost'));
  });

  it('marks tools when Linear is connected for the workspace', () => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'linear' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('tools');
  });

  it('marks tools when Jira is connected for the workspace', () => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'jira' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('tools');
  });

  it('marks tools when Sentry is connected for the workspace', () => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'sentry' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('tools');
  });

  it('marks tools when Slack is connected for the workspace', () => {
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'slack' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).toHaveBeenCalledWith('tools');
  });

  it('does not mark codeHost or tools when no workspace exists', () => {
    workspaceIntegrations = { w1: [{ provider: 'gitlab' }, { provider: 'linear' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).not.toHaveBeenCalledWith('codeHost');
    expect(markStepCompleteMock).not.toHaveBeenCalledWith('tools');
  });

  it('skips already-completed steps and never re-queries gh status', () => {
    completed = ['workspace', 'codeHost', 'tools'];
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'gitlab' }, { provider: 'linear' }] };
    renderHook(() => useOnboardingProgress());
    expect(markStepCompleteMock).not.toHaveBeenCalled();
    expect(ghStatusMock).not.toHaveBeenCalled();
  });

  it('reports completed count and total from the store', () => {
    completed = ['workspace', 'codeHost'];
    const { result } = renderHook(() => useOnboardingProgress());
    expect(result.current.completedCount).toBe(2);
    expect(result.current.totalCount).toBe(7);
    expect(result.current.isDone).toBe(false);
  });

  it('unions live completion over persisted completion on the first render', () => {
    completed = ['palette'];
    workspaces.push({ id: 'w1' });
    workspaceIntegrations = { w1: [{ provider: 'gitlab' }, { provider: 'linear' }] };
    sessions = [{}];
    sessionPhaseRuns = { s1: [{}] };
    sessionPlans = { s1: [{}] };
    const { result } = renderHook(() => useOnboardingProgress());
    expect([...result.current.completed]).toEqual([
      'palette',
      'workspace',
      'codeHost',
      'tools',
      'session',
      'agent',
      'plan',
    ]);
    expect(result.current.completedCount).toBe(7);
    expect(result.current.isDone).toBe(true);
  });

  it('keeps palette purely persisted', () => {
    const { result } = renderHook(() => useOnboardingProgress());
    expect(result.current.completed.has('palette')).toBe(false);
  });

  it('removes the code host step but keeps the tracker step for a simple workspace', () => {
    completed = ['workspace', 'tools', 'session', 'agent', 'plan', 'palette'];
    workspaces.push({ id: 'w1', kind: 'simple' });
    const { result } = renderHook(() => useOnboardingProgress());
    expect(result.current.isSimple).toBe(true);
    expect(result.current.completedCount).toBe(6);
    expect(result.current.totalCount).toBe(6);
    expect(result.current.isDone).toBe(true);
    expect(ghStatusMock).not.toHaveBeenCalled();
  });
});
