import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionId } from '@goodboy/types';

type StoreState = {
  setCurrentSession: ReturnType<typeof vi.fn>;
  setActiveLens: ReturnType<typeof vi.fn>;
  selectAgent: ReturnType<typeof vi.fn>;
  sessionPhaseRuns: Record<string, ReadonlyArray<{ id: string }>>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
};

const {
  setCurrentSessionMock,
  setActiveLensMock,
  selectAgentMock,
  openInEditorMock,
  markStepMock,
  store,
} = vi.hoisted(() => {
  const setCurrentSessionMock = vi.fn(async () => undefined);
  const setActiveLensMock = vi.fn();
  const selectAgentMock = vi.fn(async () => undefined);
  const store: { state: StoreState } = {
    state: {
      setCurrentSession: setCurrentSessionMock,
      setActiveLens: setActiveLensMock,
      selectAgent: selectAgentMock,
      sessionPhaseRuns: {},
      sessionWorktrees: {},
    },
  };
  return {
    setCurrentSessionMock,
    setActiveLensMock,
    selectAgentMock,
    openInEditorMock: vi.fn(),
    markStepMock: vi.fn(),
    store,
  };
});

vi.mock('../../../../../store', () => ({
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

function reset() {
  store.state = {
    setCurrentSession: setCurrentSessionMock,
    setActiveLens: setActiveLensMock,
    selectAgent: selectAgentMock,
    sessionPhaseRuns: {},
    sessionWorktrees: {},
  };
  setCurrentSessionMock.mockClear();
  setActiveLensMock.mockClear();
  selectAgentMock.mockClear();
  openInEditorMock.mockClear();
  markStepMock.mockClear();
  setCurrentSessionMock.mockResolvedValue(undefined);
  selectAgentMock.mockResolvedValue(undefined);
}

describe('useBoardNavigation', () => {
  beforeEach(reset);
  afterEach(reset);

  it('selectCard navigates then lands the lens on overview (null)', async () => {
    const { result } = renderHook(() => useBoardNavigation());
    result.current.selectCard(session);
    expect(setCurrentSessionMock).toHaveBeenCalledWith(SESSION_ID);
    expect(markStepMock).toHaveBeenCalledWith('session');
    await Promise.resolve();
    expect(setActiveLensMock).toHaveBeenCalledWith(SESSION_ID, null);
  });

  it('openDiff dispatches goodboy:open-diff-viewer with detail.sessionId', async () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useBoardNavigation());
    result.current.openDiff(session);
    await Promise.resolve();
    const event = dispatch.mock.calls
      .map((c) => c[0])
      .find((e): e is CustomEvent => e.type === 'goodboy:open-diff-viewer');
    expect(event).toBeTruthy();
    expect((event as CustomEvent).detail).toEqual({ sessionId: SESSION_ID });
    dispatch.mockRestore();
  });

  it('openAgent selects the first agent then reveals chat', async () => {
    store.state.sessionPhaseRuns = { [SESSION_ID]: [{ id: 'agent-1' }] };
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useBoardNavigation());
    result.current.openAgent(session);
    await Promise.resolve();
    expect(selectAgentMock).toHaveBeenCalledWith(SESSION_ID, 'agent-1');
    const revealed = dispatch.mock.calls.some((c) => c[0].type === 'goodboy:reveal-chat');
    expect(revealed).toBe(true);
    dispatch.mockRestore();
  });
});
