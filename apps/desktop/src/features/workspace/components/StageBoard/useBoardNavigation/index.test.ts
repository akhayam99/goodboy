import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionId } from '@goodboy/types';
import { sessionPlace } from '../../../../../store/slices/navigation/place';

type StoreState = {
  navigate: ReturnType<typeof vi.fn>;
  openReviewTarget: ReturnType<typeof vi.fn>;
  sessionPhaseRuns: Record<string, ReadonlyArray<{ id: string }>>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
};

const { navigateMock, openReviewTargetMock, openInEditorMock, markStepMock, store } = vi.hoisted(
  () => {
    const navigateMock = vi.fn();
    const openReviewTargetMock = vi.fn(async () => ({ kind: 'opened' as const }));
    const store: { state: StoreState } = {
      state: {
        navigate: navigateMock,
        openReviewTarget: openReviewTargetMock,
        sessionPhaseRuns: {},
        sessionWorktrees: {},
      },
    };
    return {
      navigateMock,
      openReviewTargetMock,
      openInEditorMock: vi.fn(),
      markStepMock: vi.fn(),
      store,
    };
  },
);

vi.mock('../../../../../store', async () => ({
  ...(await import('../../../../../store/slices/navigation/place')),
  useAppStore: Object.assign((selector: (s: StoreState) => unknown) => selector(store.state), {
    getState: () => store.state,
  }),
}));

vi.mock('../../../../../shared/lib/editor', () => ({
  openInEditor: openInEditorMock,
}));

vi.mock('../../../../onboarding/onboarding-store', () => ({
  markStepComplete: markStepMock,
}));

import { useBoardNavigation } from './index';

const SESSION_ID = 'sess-1' as SessionId;
const session = { id: SESSION_ID } as Session;

const reset = () => {
  store.state = {
    navigate: navigateMock,
    openReviewTarget: openReviewTargetMock,
    sessionPhaseRuns: {},
    sessionWorktrees: {},
  };
  navigateMock.mockClear();
  openReviewTargetMock.mockClear();
  openInEditorMock.mockClear();
  markStepMock.mockClear();
};

describe('useBoardNavigation', () => {
  beforeEach(reset);
  afterEach(reset);

  it('selectCard opens the overview of the card as one history voice', () => {
    const { result } = renderHook(() => useBoardNavigation());
    result.current.selectCard(session);
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: SESSION_ID }) });
    expect(markStepMock).toHaveBeenCalledWith('session');
  });

  it('openAgent opens the first agent then reveals chat', () => {
    store.state.sessionPhaseRuns = { [SESSION_ID]: [{ id: 'agent-1' }] };
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useBoardNavigation());
    result.current.openAgent(session);
    expect(navigateMock).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: 'agent-1' },
    });
    const revealed = dispatch.mock.calls.some((c) => c[0].type === 'goodboy:reveal-chat');
    expect(revealed).toBe(true);
    dispatch.mockRestore();
  });

  it('openAgent with no agents opens the overview and still reveals chat', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useBoardNavigation());
    result.current.openAgent(session);
    expect(navigateMock).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: SESSION_ID }) });
    const revealed = dispatch.mock.calls.some((c) => c[0].type === 'goodboy:reveal-chat');
    expect(revealed).toBe(true);
    dispatch.mockRestore();
  });

  it.each([
    ['openTerminal', 'terminal'],
    ['openQuestions', 'questions'],
    ['openWorkflows', 'workflows'],
  ] as const)('%s opens the %s lens', (action, lens) => {
    const { result } = renderHook(() => useBoardNavigation());
    result.current[action](session);
    expect(navigateMock).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: SESSION_ID, lens }),
    });
  });

  it('openIDE calls openInEditor with the first worktree path', () => {
    store.state.sessionWorktrees = { [SESSION_ID]: ['/tmp/wt'] };
    const { result } = renderHook(() => useBoardNavigation());
    result.current.openIDE(session);
    expect(openInEditorMock).toHaveBeenCalledWith('/tmp/wt');
  });

  it('openIDE does nothing when no worktree exists', () => {
    const { result } = renderHook(() => useBoardNavigation());
    result.current.openIDE(session);
    expect(openInEditorMock).not.toHaveBeenCalled();
  });

  it('openGithub opens the session then the review target, with no studio overlay', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useBoardNavigation());
    result.current.openGithub(session);
    expect(navigateMock).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: SESSION_ID }) });
    expect(openReviewTargetMock).toHaveBeenCalledWith({ sessionId: SESSION_ID });
    expect(
      dispatch.mock.calls
        .map((c) => c[0])
        .find((e): e is CustomEvent => e.type === 'goodboy:open-github-session'),
    ).toBeUndefined();
    dispatch.mockRestore();
  });
});
