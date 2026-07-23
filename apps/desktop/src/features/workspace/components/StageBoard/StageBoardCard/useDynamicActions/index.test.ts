// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@goodboy/types';
import type { BoardNavigation } from '../../useBoardNavigation';

const { state, pickNextMock } = vi.hoisted(() => ({
  state: {
    sessionOpenQuestions: {} as Record<string, ReadonlyArray<{ status: string }>>,
    sessionWorkflows: {} as Record<string, ReadonlyArray<{ id: string }>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<{ id: string; workflowRunId?: string }>>,
    hasUnread: false,
  },
  pickNextMock: vi.fn(),
}));

vi.mock('../../../../../../store', () => ({
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
  useSessionHasUnread: () => state.hasUnread,
}));

vi.mock('../../../../../workflows/components/WorkflowNextStepCta', () => ({
  pickNextWorkflowStep: pickNextMock,
}));

vi.mock('../../../../../context/openQuestionsGate', () => ({
  workflowRunHasOpenQuestions: () => false,
}));

import { useDynamicActions } from './index';

const nav = {
  openWorkflows: vi.fn(),
  openQuestions: vi.fn(),
  openGithub: vi.fn(),
  openAgent: vi.fn(),
} as unknown as BoardNavigation;

const sessionWith = (workflowRuns: ReadonlyArray<unknown> = []): Session =>
  ({ id: 'sess-1', workflowRuns }) as unknown as Session;

beforeEach(() => {
  state.sessionOpenQuestions = {};
  state.sessionWorkflows = {};
  state.sessionPhaseRuns = {};
  state.hasUnread = false;
  pickNextMock.mockReset();
  pickNextMock.mockReturnValue(null);
  (nav.openWorkflows as ReturnType<typeof vi.fn>).mockClear();
  (nav.openQuestions as ReturnType<typeof vi.fn>).mockClear();
  (nav.openGithub as ReturnType<typeof vi.fn>).mockClear();
  (nav.openAgent as ReturnType<typeof vi.fn>).mockClear();
});
afterEach(() => vi.clearAllMocks());

describe('useDynamicActions', () => {
  it('yields no actions for an idle building session', () => {
    const { result } = renderHook(() => useDynamicActions(sessionWith(), nav, 'building'));
    expect(result.current).toHaveLength(0);
  });

  it('surfaces an open-questions action that routes to the questions lens', () => {
    state.sessionOpenQuestions = { 'sess-1': [{ status: 'open' }, { status: 'answered' }] };
    const { result } = renderHook(() => useDynamicActions(sessionWith(), nav, 'attention'));
    const action = result.current.find((a) => a.key === 'questions');
    expect(action?.label).toBe('1 open question');
    action?.onClick();
    expect(nav.openQuestions).toHaveBeenCalledWith(sessionWith());
  });

  it('does not produce a github action for PR attention', () => {
    const { result } = renderHook(() => useDynamicActions(sessionWith(), nav, 'attention'));
    expect(result.current.some((a) => a.key === 'github')).toBe(false);
  });

  it('surfaces an unread action when the session has unread replies', () => {
    state.hasUnread = true;
    const { result } = renderHook(() => useDynamicActions(sessionWith(), nav, 'attention'));
    expect(result.current.some((a) => a.key === 'unread')).toBe(true);
  });

  it('surfaces a run action when a workflow run has a ready next step', () => {
    pickNextMock.mockReturnValue({ id: 'step-1' });
    state.sessionWorkflows = { 'sess-1': [{ id: 'wf-1' }] };
    const session = sessionWith([{ id: 'run-1', workflowId: 'wf-1' }]);
    const { result } = renderHook(() => useDynamicActions(session, nav, 'building'));
    expect(result.current.some((a) => a.key === 'run')).toBe(true);
  });

  it('suppresses the run action while an agent is running', () => {
    pickNextMock.mockReturnValue({ id: 'step-1' });
    state.sessionWorkflows = { 'sess-1': [{ id: 'wf-1' }] };
    const session = sessionWith([{ id: 'run-1', workflowId: 'wf-1' }]);
    const { result } = renderHook(() => useDynamicActions(session, nav, 'running'));
    expect(result.current.some((a) => a.key === 'run')).toBe(false);
  });
});
